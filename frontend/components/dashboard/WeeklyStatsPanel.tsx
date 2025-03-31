import { VStack, Box, HStack, Heading, Text, Spinner, Alert, AlertIcon, Center, Button, Code, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, useToast, Divider } from "@chakra-ui/react";
import moment from "moment";
import { fetchSummaryData, fetchDataWithDbFallback } from "../../lib/client";
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
      distance: activity.daily_movement || (activity.calories_total ? activity.calories_total / 10000 : 0), // Use daily_movement if available, otherwise estimate
      source: activity.source,
      sport: {
        name: "Daily Activity",
        icon: "",
        category: "activity",
        id: "daily_activity"
      }
    }));
  }
  
  return [];
};

// Type definition for the time range filter options
type TimeRangeOption = "1w" | "1m" | "6m" | "1y" | "2y" | "5y";

// Main component
export function WeeklyStatsPanel({ userId }: { userId: string | null }) {
  const toast = useToast();
  const [startDate, setStartDate] = useState(
    moment().subtract(6, 'months').toISOString()
  );
  const [endDate, setEndDate] = useState(moment().toISOString());
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("6m");
  const [apiRequests, setApiRequests] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset data fetching when userId changes
  useEffect(() => {
    if (userId) {
      setApiResponse(null);
      setApiError(null);
      setRequestDetails(null);
    }
  }, [userId]);

  // Use SWR for fetching data with caching
  const cacheKey = userId ? `workouts-${userId}-${timeRange}-${startDate}-${endDate}` : null;
  
  const { data: rawData, error, isValidating, mutate } = useSWR(
    cacheKey,
    () => {
      // Log the API request
      const requestUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/db/summary/workouts/${userId}?start_date=${startDate}&end_date=${endDate}`;
      const newRequest = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: requestUrl,
        params: {
          userId,
          startDate,
          endDate,
          timeRange
        },
        status: 'pending',
        response: null
      };
      
      setApiRequests(prev => [newRequest, ...prev].slice(0, 10)); // Keep last 10 requests
      
      return fetchDataWithDbFallback("workouts", userId as string, startDate, endDate, "workouts")
        .then(workoutsData => {
          // Also fetch activity data
          return fetchDataWithDbFallback("activity", userId as string, startDate, endDate, "activity")
            .then(activityData => {
              // Combine both sets of data
              const combinedData = {
                workouts: workoutsData,
                activity: activityData
              };
              
              // Update the request with response
              setApiRequests(prev => prev.map(req => 
                req.url === requestUrl && req.status === 'pending' 
                  ? { ...req, status: 'success', response: combinedData, responseTime: new Date().toISOString() } 
                  : req
              ));
              
              return combinedData;
            });
        })
        .catch(err => {
          // Update the request with error
          setApiRequests(prev => prev.map(req => 
            req.url === requestUrl && req.status === 'pending' 
              ? { ...req, status: 'error', error: err.message, responseTime: new Date().toISOString() } 
              : req
          ));
          throw err;
        });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onSuccess: (data) => {
        setApiResponse(data);
        // Process and combine both workout and activity data
        const processedWorkouts = processWorkoutData(data.workouts) || [];
        const processedActivities = processWorkoutData({activity: data.activity}) || [];
        const combinedData = [...processedWorkouts, ...processedActivities];
        setProcessedData(combinedData);
        
        // Store request details for debugging
        setRequestDetails({
          endpoint: 'workouts+activity',
          userId,
          startDate: moment(startDate).format('YYYY-MM-DD'),
          endDate: moment(endDate).format('YYYY-MM-DD'),
          resultCount: {
            workouts: processedWorkouts.length,
            activities: processedActivities.length,
            combined: combinedData.length
          },
          dataTypes: {
            workoutsType: typeof data.workouts,
            activitiesType: typeof data.activity
          },
          hasData: {
            workouts: Array.isArray(data.workouts) && data.workouts.length > 0,
            activities: Array.isArray(data.activity) && data.activity.length > 0
          }
        });
      },
      onError: (err) => {
        setApiError(err.message || "Unknown error occurred");
      }
    }
  );

  // Try fetching combined data if individual workout data is not available
  useEffect(() => {
    if (userId && (!rawData || (typeof rawData === 'object' && (!rawData.workouts || !rawData.activity)))) {
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
      
      // Log the API request
      const newRequest = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url,
        params: {
          userId,
          startDate,
          endDate,
          timeRange,
          endpoint: 'summary'
        },
        status: 'pending',
        response: null
      };
      
      setApiRequests(prev => [newRequest, ...prev].slice(0, 10)); // Keep last 10 requests
      
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
          // Update the request with response
          setApiRequests(prev => prev.map(req => 
            req.url === url && req.status === 'pending' 
              ? { ...req, status: 'success', response: combinedData, responseTime: new Date().toISOString() } 
              : req
          ));
          
          setApiResponse(combinedData);
          
          // Process and combine both workout and activity data
          const processedWorkouts = processWorkoutData(combinedData.workouts) || [];
          const processedActivities = processWorkoutData({activity: combinedData.activity}) || [];
          const combinedProcessedData = [...processedWorkouts, ...processedActivities];
          setProcessedData(combinedProcessedData);
          
          setRequestDetails({
            ...requestDetails,
            resultCount: {
              workouts: processedWorkouts.length,
              activities: processedActivities.length,
              combined: combinedProcessedData.length
            },
            dataTypes: {
              workoutsType: typeof combinedData.workouts,
              activitiesType: typeof combinedData.activity
            },
            hasWorkoutsKey: combinedData && typeof combinedData === 'object' && 'workouts' in combinedData,
            hasActivityKey: combinedData && typeof combinedData === 'object' && 'activity' in combinedData
          });
        })
        .catch(err => {
          // Update the request with error
          setApiRequests(prev => prev.map(req => 
            req.url === url && req.status === 'pending' 
              ? { ...req, status: 'error', error: err.message, responseTime: new Date().toISOString() } 
              : req
          ));
          
          setApiError(err.message || "Error fetching combined data");
          setRequestDetails({
            ...requestDetails,
            error: err.message
          });
        });
    }
  }, [userId, rawData, startDate, endDate]);

  const handleDateChange = (period: TimeRangeOption) => {
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

  // Function to download user data
  const downloadUserData = async (specificUserId?: string) => {
    setIsDownloading(true);
    
    // Use the explicitly passed userId, or fall back to the current userId
    // Convert null to undefined to satisfy TypeScript
    const userIdToUse = specificUserId || (userId || undefined);
    
    if (!userIdToUse) {
      toast({
        title: "No user selected",
        description: "Please select a user first",
        status: "error",
        duration: 3000,
        isClosable: true
      });
      setIsDownloading(false);
      return;
    }
    
    // Create a list of endpoints to try in order
    const endpoints = [
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/download/${userIdToUse}?start_date=${startDate}&end_date=${endDate}`,
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/summary/${userIdToUse}?start_date=${startDate}&end_date=${endDate}`,
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/summary/workouts/${userIdToUse}?start_date=${startDate}&end_date=${endDate}`,
      // Try without dates as final fallback
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/download/${userIdToUse}`
    ];
    
    let successfulData = null;
    let lastError = null;
    
    // Try each endpoint in sequence until one works
    for (let i = 0; i < endpoints.length; i++) {
      const downloadUrl = endpoints[i];
      
      // Log the download attempt in the request log
      const newRequest = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: downloadUrl,
        params: {
          userId: userIdToUse,
          startDate: endpoints[i].includes('start_date') ? startDate : null,
          endDate: endpoints[i].includes('end_date') ? endDate : null,
          purpose: 'download',
          attemptNumber: i + 1,
          totalAttempts: endpoints.length
        },
        status: 'pending',
        response: null
      };
      
      setApiRequests(prev => [newRequest, ...prev].slice(0, 10));
      
      try {
        console.log(`Download attempt ${i + 1}/${endpoints.length}: ${downloadUrl}`);
        
        const response = await fetch(downloadUrl);
        const responseStatus = `${response.status} ${response.statusText}`;
        
        if (!response.ok) {
          throw new Error(`API returned status: ${responseStatus}`);
        }
        
        const data = await response.json();
        
        // Check if data is empty or just an empty array/object
        if (!data || 
            (Array.isArray(data) && data.length === 0) || 
            (typeof data === 'object' && Object.keys(data).length === 0)) {
          throw new Error("API returned empty data");
        }
        
        // Update request log with success
        setApiRequests(prev => prev.map(req => 
          req.url === downloadUrl && req.status === 'pending' 
            ? { ...req, status: 'success', response: data, responseTime: new Date().toISOString() } 
            : req
        ));
        
        // We got data successfully
        successfulData = data;
        break;
      } catch (error: any) {
        // Update request log with error
        setApiRequests(prev => prev.map(req => 
          req.url === downloadUrl && req.status === 'pending' 
            ? { ...req, status: 'error', error: error.message, responseTime: new Date().toISOString() } 
            : req
        ));
        
        console.error(`Download attempt ${i + 1} failed:`, error.message);
        lastError = error;
        
        // Continue to try the next endpoint
      }
    }
    
    // If we have data, create and download the file
    if (successfulData) {
      try {
        // Format the data to make it more readable
        let formattedData = successfulData;
        
        // If it's a successful response from our new download endpoint, it already has good structure
        // Otherwise, add some structure to make it more readable
        if (!('metadata' in successfulData)) {
          formattedData = {
            metadata: {
              user_id: userIdToUse,
              download_date: new Date().toISOString(),
              start_date: startDate,
              end_date: endDate,
              data_source: "frontend_structured"
            },
            data: successfulData
          };
        }
        
        // Create a downloadable file
        const blob = new Blob([JSON.stringify(formattedData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `user_data_${userIdToUse}_${moment().format('YYYY-MM-DD')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Download complete",
          description: "User data has been downloaded successfully",
          status: "success",
          duration: 3000,
          isClosable: true
        });
      } catch (error: any) {
        console.error("Error creating download file:", error);
        toast({
          title: "Download error",
          description: `Could not create download file: ${error.message}`,
          status: "error",
          duration: 5000,
          isClosable: true
        });
      }
    } else {
      // All endpoints failed
      toast({
        title: "Download failed",
        description: `All download attempts failed. Last error: ${lastError?.message || "Unknown error"}`,
        status: "error",
        duration: 5000,
        isClosable: true
      });
      
      // Show toast with instructions for checking network tab
      toast({
        title: "Troubleshooting",
        description: "Check the API Request Monitor below or browser's Network tab for details",
        status: "info",
        duration: 8000,
        isClosable: true
      });
    }
    
    setIsDownloading(false);
  };

  // New function to download data until March 5th
  const downloadUserDataUntilMarch5 = async (specificUserId?: string) => {
    setIsDownloading(true);
    
    // Use the explicitly passed userId, or fall back to the current userId
    // Convert null to undefined to satisfy TypeScript
    const userIdToUse = specificUserId || (userId || undefined);
    
    if (!userIdToUse) {
      toast({
        title: "No user selected",
        description: "Please select a user first",
        status: "error",
        duration: 3000,
        isClosable: true
      });
      setIsDownloading(false);
      return;
    }
    
    // Set specific end date to March 5, 2025
    const testEndDate = "2025-03-05T23:59:59.999Z";
    
    // Create a list of endpoints to try in order with the March 5th end date
    const endpoints = [
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/download/${userIdToUse}?start_date=${startDate}&end_date=${testEndDate}`,
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/summary/${userIdToUse}?start_date=${startDate}&end_date=${testEndDate}`,
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/summary/workouts/${userIdToUse}?start_date=${startDate}&end_date=${testEndDate}`,
      // Try without dates as final fallback
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/download/${userIdToUse}`
    ];
    
    let successfulData = null;
    let lastError = null;
    
    // Try each endpoint in sequence until one works
    for (let i = 0; i < endpoints.length; i++) {
      const downloadUrl = endpoints[i];
      
      // Log the download attempt in the request log
      const newRequest = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: downloadUrl,
        params: {
          userId: userIdToUse,
          startDate: endpoints[i].includes('start_date') ? startDate : null,
          endDate: endpoints[i].includes('end_date') ? testEndDate : null,
          purpose: 'download until March 5th',
          attemptNumber: i + 1,
          totalAttempts: endpoints.length
        },
        status: 'pending',
        response: null
      };
      
      setApiRequests(prev => [newRequest, ...prev].slice(0, 10));
      
      try {
        console.log(`Download attempt ${i + 1}/${endpoints.length}: ${downloadUrl}`);
        
        const response = await fetch(downloadUrl);
        const responseStatus = `${response.status} ${response.statusText}`;
        
        if (!response.ok) {
          throw new Error(`API returned status: ${responseStatus}`);
        }
        
        const data = await response.json();
        
        // Check if data is empty or just an empty array/object
        if (!data || 
            (Array.isArray(data) && data.length === 0) || 
            (typeof data === 'object' && Object.keys(data).length === 0)) {
          throw new Error("API returned empty data");
        }
        
        // Update request log with success
        setApiRequests(prev => prev.map(req => 
          req.url === downloadUrl && req.status === 'pending' 
            ? { ...req, status: 'success', response: data, responseTime: new Date().toISOString() } 
            : req
        ));
        
        // We got data successfully
        successfulData = data;
        break;
      } catch (error: any) {
        // Update request log with error
        setApiRequests(prev => prev.map(req => 
          req.url === downloadUrl && req.status === 'pending' 
            ? { ...req, status: 'error', error: error.message, responseTime: new Date().toISOString() } 
            : req
        ));
        
        console.error(`Download attempt ${i + 1} failed:`, error.message);
        lastError = error;
        
        // Continue to try the next endpoint
      }
    }
    
    // If we have data, create and download the file
    if (successfulData) {
      try {
        // Format the data to make it more readable
        let formattedData = successfulData;
        
        // If it's a successful response from our new download endpoint, it already has good structure
        // Otherwise, add some structure to make it more readable
        if (!('metadata' in successfulData)) {
          formattedData = {
            metadata: {
              user_id: userIdToUse,
              download_date: new Date().toISOString(),
              start_date: startDate,
              end_date: testEndDate,
              data_source: "frontend_structured",
              test_note: "Data until March 5th, 2025"
            },
            data: successfulData
          };
        }
        
        // Create a downloadable file
        const blob = new Blob([JSON.stringify(formattedData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `user_data_until_march5_${userIdToUse}_${moment().format('YYYY-MM-DD')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Test download complete",
          description: "User data until March 5th has been downloaded successfully",
          status: "success",
          duration: 3000,
          isClosable: true
        });
      } catch (error: any) {
        console.error("Error creating download file:", error);
        toast({
          title: "Download error",
          description: `Could not create download file: ${error.message}`,
          status: "error",
          duration: 5000,
          isClosable: true
        });
      }
    } else {
      // All endpoints failed
      toast({
        title: "Test download failed",
        description: `All download attempts failed. Last error: ${lastError?.message || "Unknown error"}`,
        status: "error",
        duration: 5000,
        isClosable: true
      });
      
      // Show toast with instructions for checking network tab
      toast({
        title: "Troubleshooting",
        description: "Check the API Request Monitor below or browser's Network tab for details",
        status: "info",
        duration: 8000,
        isClosable: true
      });
    }
    
    setIsDownloading(false);
  };

  // Use @ts-ignore to bypass the complex union type error
  // @ts-ignore: Expression produces a union type that is too complex to represent
  return (
    // @ts-ignore: Expression produces a union type that is too complex to represent
    <VStack
      p="6"
      bg="white"
      shadow="base"
      rounded="lg"
      height="100%"
      my={10}
      spacing={6}
      alignItems="flex-start"
    >
      <VStack width="100%" alignItems="flex-start" spacing={1}>
        <Heading size="md">Weekly Workout Metrics</Heading>
        <Text fontSize="sm" color="gray.600">
          Track your weekly workout volume and velocity over time
        </Text>
        {userId && (
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="xs" color="blue.500">Selected user ID: {userId}</Text>
            <Button size="xs" colorScheme="blue" onClick={refreshData}>
              Refresh Data
            </Button>
            <Button 
              size="xs" 
              colorScheme="green" 
              onClick={() => downloadUserData()} 
              isLoading={isDownloading}
              loadingText="Downloading"
            >
              Download Data
            </Button>
            <Button 
              size="xs" 
              colorScheme="teal" 
              onClick={() => downloadUserData("a5ab4305-5aba-42f9-9bff-a4cbca331780")}
              isLoading={isDownloading}
              loadingText="Downloading"
            >
              Download Specified User Data
            </Button>
            <Button 
              size="xs" 
              colorScheme="purple" 
              onClick={() => downloadUserDataUntilMarch5("a5ab4305-5aba-42f9-9bff-a4cbca331780")}
              isLoading={isDownloading}
              loadingText="Testing"
            >
              Test Until March 5
            </Button>
          </HStack>
        )}
      </VStack>

      <HStack width="100%" justifyContent="flex-end">
        <RadioButtons
          options={["1w", "1m", "6m", "1y", "2y", "5y"]}
          defaultValue="6m"
          onChange={handleDateChange}
          selectedColor="#8884d8"
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
        <Box width="100%">
          <Alert status="info" rounded="md">
            <AlertIcon />
            No workout data found for this user in the selected time period. Try connecting more data sources or selecting a different time range.
          </Alert>
          
          <Text fontSize="sm" fontWeight="bold" mt={4}>Diagnostic Information:</Text>
          
          <Accordion allowToggle width="100%" mt={2}>
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
        </Box>
      )}

      {userId && hasData && (
        <Box width="100%">
          <Box width="100%" height="300px">
            <Heading size="sm" mb={2}>Weekly Workout Volume (km)</Heading>
            <WeeklyVolumeGraph 
              data={processedData} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </Box>

          <Box width="100%" height="300px" mt={6}>
            <Heading size="sm" mb={2}>Average Weekly Velocity (km/h)</Heading>
            <WeeklyVelocityGraph 
              data={processedData} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </Box>
          
          <Text fontSize="sm" color="gray.600" mt={2}>
            Found {processedData.length} workouts in selected period
          </Text>
        </Box>
      )}
      
      {/* API Request/Response Monitor */}
      <Divider my={3} />
      <Box width="100%">
        <Accordion allowToggle width="100%">
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">API Request/Response Monitor</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <Text fontSize="sm" mb={2}>Recent API requests and responses ({apiRequests.length})</Text>
              
              {apiRequests.length > 0 ? (
                apiRequests.map((req, index) => (
                  <Box 
                    key={index} 
                    p={3} 
                    mb={2} 
                    rounded="md" 
                    bg={
                      req.status === 'pending' ? 'yellow.50' :
                      req.status === 'success' ? 'green.50' : 'red.50'
                    }
                    border="1px" 
                    borderColor={
                      req.status === 'pending' ? 'yellow.200' :
                      req.status === 'success' ? 'green.200' : 'red.200'
                    }
                  >
                    <Text fontSize="xs" fontWeight="bold">
                      {moment(req.timestamp).format('YYYY-MM-DD HH:mm:ss')} - 
                      {req.method} {req.url}
                    </Text>
                    <Text fontSize="xs">Status: {req.status}</Text>
                    
                    <Accordion allowToggle size="sm" mt={1}>
                      <AccordionItem>
                        <h3>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              <Text fontSize="xs">Request Details</Text>
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>
                        </h3>
                        <AccordionPanel pb={2}>
                          <Code p={2} rounded="md" width="100%" fontSize="xs" whiteSpace="pre-wrap">
                            {JSON.stringify(req.params, null, 2)}
                          </Code>
                        </AccordionPanel>
                      </AccordionItem>
                      
                      <AccordionItem>
                        <h3>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              <Text fontSize="xs">
                                {req.status === 'pending' ? 'Waiting for response...' : 
                                 req.status === 'success' ? 'Response Data' : 'Error Details'}
                              </Text>
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>
                        </h3>
                        <AccordionPanel pb={2}>
                          {req.status === 'pending' ? (
                            <Text fontSize="xs">Request in progress...</Text>
                          ) : req.status === 'success' ? (
                            <Code p={2} rounded="md" width="100%" fontSize="xs" whiteSpace="pre-wrap">
                              {JSON.stringify(req.response, null, 2)}
                            </Code>
                          ) : (
                            <Alert status="error" size="sm">
                              <AlertIcon />
                              <Text fontSize="xs">{req.error}</Text>
                            </Alert>
                          )}
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>
                  </Box>
                ))
              ) : (
                <Text fontSize="sm" color="gray.500">No API requests have been made yet</Text>
              )}
            </AccordionPanel>
          </AccordionItem>
          
          {/* Keep existing accordion items */}
          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Request Details</Heading>
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
                  <Heading size="sm">API Response</Heading>
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
      </Box>
    </VStack>
  );
} 