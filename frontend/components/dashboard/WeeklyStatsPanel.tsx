import { VStack, Box, HStack, Heading, Text, Spinner, Alert, AlertIcon, Center, Button, Code, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon } from "@chakra-ui/react";
import moment from "moment";
import { fetchSummaryData } from "../../lib/client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { RadioButtons } from "./customRadio";
import { WeeklyVolumeGraph } from "./WeeklyVolumeGraph";
import { WeeklyVelocityGraph } from "./WeeklyVelocityGraph";

// Process data regardless of structure
const processWorkoutData = (data: any) => {
  if (!data) return [];
  
  // If there's a workout array, use that directly
  if (data.workouts && Array.isArray(data.workouts)) {
    return data.workouts;
  }
  
  // If it's already an array of workouts
  if (Array.isArray(data)) {
    return data;
  }
  
  // If it has an 'activity' property, try to adapt it to workout format
  if (data.activity && Array.isArray(data.activity)) {
    return data.activity.map((activity: any) => ({
      // Map activity fields to workout fields
      time_start: activity.date,
      time_end: moment(activity.date).add(1, 'hour').toISOString(), // Estimate end time
      calories: activity.calories_total || 0,
      duration: (activity.high || 0) + (activity.medium || 0) + (activity.low || 0),
      distance: activity.calories_total ? activity.calories_total / 10000 : 0, // Estimate distance in km with proper scaling
      source: activity.source,
      sport: {
        name: "Exercise",
        icon: "",
        category: "cardio",
        id: "exercise"
      }
    }));
  }
  
  return [];
};

export const WeeklyStatsPanel = ({ userId }: { userId: string | null }) => {
  const [startDate, setStartDate] = useState(
    moment().subtract(6, 'months').toISOString()
  );
  const [endDate, setEndDate] = useState(moment().toISOString());
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<string>("6m");

  // Reset data fetching when userId changes
  useEffect(() => {
    if (userId) {
      setApiResponse(null);
      setApiError(null);
      setRequestDetails(null);
    }
  }, [userId]);

  // Create a cache key that includes the time range for properly triggering refetches
  const cacheKey = userId ? ["workouts", userId, startDate, endDate, "workouts", timeRange] : null;

  const { data: rawData, error, isValidating, mutate } = useSWR(
    cacheKey,
    () => fetchSummaryData("workouts", userId as string, startDate, endDate, "workouts"),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onSuccess: (data) => {
        setApiResponse(data);
        const processed = processWorkoutData(data);
        setProcessedData(processed);
        
        // Store request details for debugging
        setRequestDetails({
          endpoint: 'workouts',
          userId,
          startDate: moment(startDate).format('YYYY-MM-DD'),
          endDate: moment(endDate).format('YYYY-MM-DD'),
          resultCount: processed.length,
          dataType: typeof data,
          isArray: Array.isArray(data)
        });
      },
      onError: (err) => {
        setApiError(err.message || "Unknown error occurred");
      }
    }
  );

  // Try fetching combined data if individual workout data is not available
  useEffect(() => {
    if (userId && (!rawData || (Array.isArray(rawData) && rawData.length === 0))) {
      // Clear previous error when trying alternate endpoint
      setApiError(null);
      
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/summary/${userId}?start_date=${startDate}&end_date=${endDate}`;
      
      // Update request details
      setRequestDetails({
        ...requestDetails,
        endpoint: 'summary',
        url,
        status: 'fetching'
      });
      
      fetch(url)
        .then(res => {
          setRequestDetails({
            ...requestDetails,
            status: res.status,
            statusText: res.statusText
          });
          
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        })
        .then(combinedData => {
          setApiResponse(combinedData);
          const processed = processWorkoutData(combinedData);
          setProcessedData(processed);
          
          setRequestDetails({
            ...requestDetails,
            resultCount: processed.length,
            dataType: typeof combinedData,
            isArray: Array.isArray(combinedData),
            hasWorkoutsKey: combinedData && typeof combinedData === 'object' && 'workouts' in combinedData,
            hasActivityKey: combinedData && typeof combinedData === 'object' && 'activity' in combinedData
          });
        })
        .catch(err => {
          setApiError(err.message || "Error fetching combined data");
          setRequestDetails({
            ...requestDetails,
            error: err.message
          });
        });
    }
  }, [userId, rawData, startDate, endDate]);

  const handleDateChange = (period: "1w" | "1m" | "6m" | "1y" | "2y" | "5y") => {
    // Save the selected time range
    setTimeRange(period);
    
    // Update date range based on selection
    let newStartDate;
    switch (period) {
      case "1w":
        newStartDate = moment().subtract(1, "week").toISOString();
        break;
      case "1m":
        newStartDate = moment().subtract(1, "month").toISOString();
        break;
      case "6m":
        newStartDate = moment().subtract(6, "months").toISOString();
        break;
      case "1y":
        newStartDate = moment().subtract(1, "year").toISOString();
        break;
      case "2y":
        newStartDate = moment().subtract(2, "years").toISOString();
        break;
      case "5y":
        newStartDate = moment().subtract(5, "years").toISOString();
        break;
      default:
        return;
    }
    
    // Always update end date to current time
    const newEndDate = moment().toISOString();
    
    // Update state to trigger data fetch
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Clear previous error and response when changing date range
    setApiError(null);
    setApiResponse(null);
    
    // Force a data refresh with the new date range
    setTimeout(() => mutate(), 0);
  };

  const refreshData = () => {
    // Clear previous error and response when refreshing
    setApiError(null);
    setApiResponse(null);
    mutate();
  };

  const hasData = processedData && processedData.length > 0;

  return (
    <VStack
      p="6"
      bg="white"
      shadow="base"
      rounded="lg"
      height="100%"
      my={10}
      spacing={6}
      alignItems={"flex-start"}
    >
      <VStack width="100%" alignItems="flex-start" spacing={1}>
        <Heading size="md">Weekly Workout Metrics</Heading>
        <Text fontSize="sm" color="gray.600">
          Track your weekly workout volume and velocity over time
        </Text>
        {userId && (
          <HStack>
            <Text fontSize="xs" color="blue.500">Selected user ID: {userId}</Text>
            <Button size="xs" colorScheme="blue" onClick={refreshData}>
              Refresh Data
            </Button>
          </HStack>
        )}
      </VStack>

      <HStack width={"100%"} justifyContent={"flex-end"}>
        <RadioButtons
          options={["1w", "1m", "6m", "1y", "2y", "5y"]}
          defaultValue={"6m"}
          onChange={handleDateChange}
          selectedColor={"#8884d8"}
        />
      </HStack>

      {!userId && (
        <Center width="100%" py={10}>
          <Text color="gray.500">Select a user by clicking "Analyze Data" above</Text>
        </Center>
      )}

      {userId && isValidating && (
        <Center width="100%" py={10}>
          <VStack>
            <Spinner color="#8884d8" size="xl" />
            <Text mt={4}>Fetching workout data... This may take a moment.</Text>
          </VStack>
        </Center>
      )}

      {userId && apiError && (
        <Alert status="error" rounded="md" flexDirection="column" alignItems="flex-start">
          <AlertIcon />
          <Text mb={2}>Error loading workout data: {apiError}</Text>
          <Text fontSize="sm">
            Try selecting a different time range or connecting your Strava account again.
          </Text>
        </Alert>
      )}

      {userId && !isValidating && !hasData && (
        <VStack width="100%" alignItems="flex-start" spacing={4}>
          <Alert status="info" rounded="md">
            <AlertIcon />
            No workout data found for this user in the selected time period. Try connecting more data sources or selecting a different time range.
          </Alert>
          
          <Text fontSize="sm" fontWeight="bold">Diagnostic Information:</Text>
          
          <Accordion allowToggle width="100%">
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    Request Details
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Code p={2} rounded="md" width="100%" fontSize="xs" whiteSpace="pre-wrap">
                  {requestDetails ? JSON.stringify(requestDetails, null, 2) : "No request details available"}
                </Code>
              </AccordionPanel>
            </AccordionItem>
            
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    API Response
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Code p={2} rounded="md" width="100%" fontSize="xs" whiteSpace="pre-wrap">
                  {apiResponse ? JSON.stringify(apiResponse, null, 2) : "No API response received"}
                </Code>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
          
          <Text fontSize="sm" mt={2}>
            Note: You need at least one workout in Strava that falls within your selected date range. 
            Your current date range is: {moment(startDate).format('YYYY-MM-DD')} to {moment(endDate).format('YYYY-MM-DD')}
          </Text>
        </VStack>
      )}

      {userId && hasData && (
        <>
          <Box width={"100%"} height={"300px"}>
            <Heading size="sm" mb={2}>Weekly Workout Volume (km)</Heading>
            <WeeklyVolumeGraph data={processedData} />
          </Box>

          <Box width={"100%"} height={"300px"}>
            <Heading size="sm" mb={2}>Average Weekly Velocity (km/h)</Heading>
            <WeeklyVelocityGraph data={processedData} />
          </Box>
          
          {/* Show number of workouts found */}
          <Text fontSize="sm" color="gray.600">
            Found {processedData.length} workouts in selected period
          </Text>
        </>
      )}
    </VStack>
  );
}; 