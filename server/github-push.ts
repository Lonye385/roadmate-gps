import { Octokit } from '@octokit/rest'
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function getAllFiles(dir: string, baseDir: string = dir): Promise<{path: string, content: string}[]> {
  const files: {path: string, content: string}[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.endsWith('.tar.gz')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else {
      try {
        const content = fs.readFileSync(fullPath);
        const base64Content = content.toString('base64');
        files.push({ path: relativePath, content: base64Content });
      } catch (e) {
        console.log(`Skipping ${relativePath}: ${e}`);
      }
    }
  }
  
  return files;
}

async function pushToGitHub() {
  console.log('🚀 Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`✅ Authenticated as: ${user.login}`);
  
  const repoName = 'roadmate-gps';
  
  let repo;
  try {
    const { data } = await octokit.repos.get({
      owner: user.login,
      repo: repoName
    });
    repo = data;
    console.log(`📂 Repository exists: ${repo.html_url}`);
  } catch (e) {
    console.log('📁 Creating new repository...');
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: 'ROADMATE - Professional GPS Navigation PWA for Europe with 132k speed cameras',
      private: false,
      auto_init: true
    });
    repo = data;
    console.log(`✅ Created: ${repo.html_url}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('📦 Collecting files...');
  const projectDir = '/home/runner/workspace';
  const foldersToUpload = ['public', 'client/src', 'server', 'shared'];
  const filesToUpload = ['package.json', 'tsconfig.json', 'vite.config.ts', 'drizzle.config.ts', 'tailwind.config.ts', 'postcss.config.js', 'replit.md'];
  
  let allFiles: {path: string, content: string}[] = [];
  
  for (const folder of foldersToUpload) {
    const folderPath = path.join(projectDir, folder);
    if (fs.existsSync(folderPath)) {
      const files = await getAllFiles(folderPath, projectDir);
      allFiles.push(...files);
    }
  }
  
  for (const file of filesToUpload) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      allFiles.push({ path: file, content: content.toString('base64') });
    }
  }
  
  console.log(`📄 Found ${allFiles.length} files to upload`);
  
  let { data: refData } = await octokit.git.getRef({
    owner: user.login,
    repo: repoName,
    ref: 'heads/main'
  });
  const latestCommitSha = refData.object.sha;
  
  const { data: commitData } = await octokit.git.getCommit({
    owner: user.login,
    repo: repoName,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commitData.tree.sha;
  
  console.log('🌳 Creating tree...');
  const treeItems = allFiles.map(file => ({
    path: file.path,
    mode: '100644' as const,
    type: 'blob' as const,
    content: Buffer.from(file.content, 'base64').toString('utf-8')
  }));
  
  const batchSize = 50;
  let currentTreeSha = baseTreeSha;
  
  for (let i = 0; i < treeItems.length; i += batchSize) {
    const batch = treeItems.slice(i, i + batchSize);
    console.log(`  Uploading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(treeItems.length/batchSize)}...`);
    
    const { data: treeData } = await octokit.git.createTree({
      owner: user.login,
      repo: repoName,
      base_tree: currentTreeSha,
      tree: batch
    });
    currentTreeSha = treeData.sha;
  }
  
  console.log('💾 Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner: user.login,
    repo: repoName,
    message: 'ROADMATE GPS - Full project upload from Replit',
    tree: currentTreeSha,
    parents: [latestCommitSha]
  });
  
  await octokit.git.updateRef({
    owner: user.login,
    repo: repoName,
    ref: 'heads/main',
    sha: newCommit.sha
  });
  
  console.log('');
  console.log('✅ SUCCESS! Project uploaded to GitHub!');
  console.log(`🔗 URL: ${repo.html_url}`);
  console.log('');
}

pushToGitHub().catch(console.error);
