import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, ThumbsUp, MapPin, Clock } from "lucide-react";
import { insertReportSchema } from "@shared/schema";
import type { InsertReport, Report } from "@shared/schema";
import { z } from "zod";

interface ReportsProps {
  userId: string;
}

const formSchema = insertReportSchema.extend({
  latitude: z.coerce.number(),
  longitude: z.coerce.number()
});

export default function Reports({ userId }: ReportsProps) {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"]
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId,
      type: "",
      latitude: 51.5074,
      longitude: -0.1278,
      location: "",
      description: "",
      severity: "medium"
    }
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: InsertReport) => {
      const result = await apiRequest("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return result as any;
    },
    onSuccess: () => {
      toast({
        title: "Report submitted!",
        description: "Thank you for helping the community stay safe.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      form.reset();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit report",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const upvoteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const result = await apiRequest(`/api/reports/${reportId}/upvote`, {
        method: "POST"
      });
      return result as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    }
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createReportMutation.mutate(data as InsertReport);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Traffic Reports</h1>
            <p className="text-muted-foreground">Share and view real-time road alerts</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            data-testid="button-toggle-form"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            {showForm ? "Cancel" : "New Report"}
          </Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Submit Traffic Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-report-type">
                              <SelectValue placeholder="Select report type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="accident">Accident</SelectItem>
                            <SelectItem value="traffic">Heavy Traffic</SelectItem>
                            <SelectItem value="roadwork">Road Work</SelectItem>
                            <SelectItem value="hazard">Road Hazard</SelectItem>
                            <SelectItem value="police">Police</SelectItem>
                            <SelectItem value="weather">Bad Weather</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., M25 Junction 15" data-testid="input-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="any" data-testid="input-latitude" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="any" data-testid="input-longitude" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-severity">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""}
                            placeholder="Additional details about the incident" 
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createReportMutation.isPending}
                    data-testid="button-submit-report"
                  >
                    {createReportMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">Loading reports...</div>
          ) : reports && reports.length > 0 ? (
            reports.map((report) => (
              <Card key={report.id} data-testid={`card-report-${report.id}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-6 h-6 text-primary" />
                        <h3 className="text-xl font-bold capitalize">{report.type}</h3>
                        <Badge variant={getSeverityColor(report.severity) as any}>
                          {report.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {report.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(report.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {report.description && (
                        <p className="mt-2 text-sm">{report.description}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => upvoteMutation.mutate(report.id)}
                      disabled={upvoteMutation.isPending}
                      data-testid={`button-upvote-${report.id}`}
                    >
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      {report.upvotes}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-xl text-muted-foreground">
                  No reports yet. Be the first to share a road alert!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
