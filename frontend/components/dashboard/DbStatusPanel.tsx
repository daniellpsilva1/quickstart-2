import { Box, Heading, Text, Badge, Stat, StatLabel, StatNumber, StatGroup, StatHelpText, useInterval } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/client";

// Define types for database status response
interface DbStatusResponse {
  status: string;
  counts?: {
    users: number;
    workouts: number;
    api_requests: number;
    pending_requests: number;
    complete_date_ranges: number;
  };
  latest_request?: {
    id: number | null;
    status: string | null;
    requested_at: string | null;
    completed_at: string | null;
  };
  message?: string;
}

export function DbStatusPanel() {
  const { data, error, mutate } = useSWR<DbStatusResponse>("/db/status", fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });
  
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Helper function to determine badge color based on status
  const getStatusColor = (status: string | null): string => {
    if (!status) return "gray";
    
    switch (status) {
      case "completed":
        return "green";
      case "pending":
        return "yellow";
      case "in_progress":
        return "blue";
      default:
        return "red";
    }
  };
  
  return (
    <Box p={4} borderWidth="1px" borderRadius="lg">
      <Heading size="md" mb={4}>Database Status</Heading>
      
      {error && (
        <Text color="red.500">Error connecting to database: {error.message}</Text>
      )}
      
      {!data && !error && (
        <Text>Loading database status...</Text>
      )}
      
      {data && (
        <>
          <Badge colorScheme={data.status === "connected" ? "green" : "red"}>{data.status}</Badge>
          
          <StatGroup mt={4}>
            <Stat>
              <StatLabel>Users</StatLabel>
              <StatNumber>{data.counts?.users || 0}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel>Workouts</StatLabel>
              <StatNumber>{data.counts?.workouts || 0}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel>Pending Requests</StatLabel>
              <StatNumber>{data.counts?.pending_requests || 0}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel>Complete Ranges</StatLabel>
              <StatNumber>{data.counts?.complete_date_ranges || 0}</StatNumber>
            </Stat>
          </StatGroup>
          
          {data.latest_request && (
            <Box mt={4}>
              <Text fontWeight="bold">Latest Request:</Text>
              <Text>Status: <Badge colorScheme={getStatusColor(data.latest_request.status)}>
                {data.latest_request.status || "unknown"}
              </Badge></Text>
              <Text>Requested: {formatDate(data.latest_request.requested_at)}</Text>
              {data.latest_request.completed_at && (
                <Text>Completed: {formatDate(data.latest_request.completed_at)}</Text>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
} 