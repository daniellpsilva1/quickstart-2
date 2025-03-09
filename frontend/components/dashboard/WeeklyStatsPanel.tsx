import { VStack, Box, HStack, Heading, Text, Spinner, Alert, AlertIcon, Center, Button } from "@chakra-ui/react";
import moment from "moment";
import { fetchSummaryData } from "../../lib/client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { RadioButtons } from "./customRadio";
import { WeeklyVolumeGraph } from "./WeeklyVolumeGraph";
import { WeeklyVelocityGraph } from "./WeeklyVelocityGraph";

// Process data regardless of structure
const processActivityData = (data: any) => {
  if (!data) return [];
  
  // If it's an array, it's likely already the activity array
  if (Array.isArray(data)) {
    console.log("Data is already an array with", data.length, "items");
    return data;
  }
  
  // If it has an 'activity' property, use that
  if (data.activity && Array.isArray(data.activity)) {
    console.log("Found activity array in response with", data.activity.length, "items");
    return data.activity;
  }
  
  // If there's a workout array, try to adapt it to activity format
  if (data.workouts && Array.isArray(data.workouts)) {
    console.log("Found workouts array in response, adapting to activity format");
    return data.workouts.map((workout: any) => ({
      // Map workout fields to activity fields
      date: workout.time_start,
      calories_active: workout.calories || 0,
      calories_total: workout.calories || 0,
      high: workout.duration || 0, // Use duration as high intensity minutes
      medium: 0,
      low: 0,
      source: workout.source
    }));
  }
  
  console.log("Could not find usable activity data in response");
  return [];
};

export const WeeklyStatsPanel = ({ userId }: { userId: any }) => {
  const [startDate, setStartDate] = useState(
    moment().subtract(6, 'months').toISOString()
  );
  const [endDate, setEndDate] = useState(moment().toISOString());
  const [processedData, setProcessedData] = useState<any[]>([]);

  // Reset data fetching when userId changes
  useEffect(() => {
    console.log("User ID changed to:", userId);
  }, [userId]);

  const { data: rawData, error, isValidating, mutate } = useSWR(
    userId ? ["activity", userId, startDate, endDate, "activity"] : null,
    fetchSummaryData,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onSuccess: (data) => {
        console.log("Data fetched successfully, processing...");
        const processed = processActivityData(data);
        setProcessedData(processed);
      },
      onError: (err) => {
        console.error("Error fetching data:", err);
      }
    }
  );

  // Try fetching combined data if individual activity data is not available
  useEffect(() => {
    if (userId && (!rawData || (Array.isArray(rawData) && rawData.length === 0))) {
      console.log("Attempting to fetch combined summary data...");
      fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/summary/${userId}?start_date=${startDate}&end_date=${endDate}`)
        .then(res => {
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        })
        .then(combinedData => {
          console.log("Combined data received:", combinedData);
          const processed = processActivityData(combinedData);
          setProcessedData(processed);
        })
        .catch(err => {
          console.error("Error fetching combined data:", err);
        });
    }
  }, [userId, rawData, startDate, endDate]);

  const handleDateChange = (period: "1w" | "1m" | "6m" | "1y" | "2y" | "5y") => {
    console.log("Changing time period to:", period);
    switch (period) {
      case "1w":
        setStartDate(moment().subtract(1, "week").toISOString());
        break;
      case "1m":
        setStartDate(moment().subtract(1, "month").toISOString());
        break;
      case "6m":
        setStartDate(moment().subtract(6, "months").toISOString());
        break;
      case "1y":
        setStartDate(moment().subtract(1, "year").toISOString());
        break;
      case "2y":
        setStartDate(moment().subtract(2, "years").toISOString());
        break;
      case "5y":
        setStartDate(moment().subtract(5, "years").toISOString());
        break;
      default:
        return;
    }
    // Always update end date to current time
    setEndDate(moment().toISOString());
  };

  const refreshData = () => {
    console.log("Manually refreshing data...");
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
        <Heading size="md">Weekly Performance Metrics</Heading>
        <Text fontSize="sm" color="gray.600">
          Track your weekly volume and velocity over time
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
          <Spinner color="#8884d8" size="xl" />
        </Center>
      )}

      {userId && error && (
        <Alert status="error" rounded="md">
          <AlertIcon />
          Error loading data: {error.message}. Please try again.
        </Alert>
      )}

      {userId && !isValidating && !hasData && (
        <Alert status="info" rounded="md">
          <AlertIcon />
          No activity data found for this user in the selected time period. Try connecting more data sources or selecting a different time range.
        </Alert>
      )}

      {userId && hasData && (
        <>
          <Box width={"100%"} height={"300px"}>
            <Heading size="sm" mb={2}>Weekly Volume (km)</Heading>
            <WeeklyVolumeGraph data={processedData} />
          </Box>

          <Box width={"100%"} height={"300px"}>
            <Heading size="sm" mb={2}>Average Weekly Velocity (km/h)</Heading>
            <WeeklyVelocityGraph data={processedData} />
          </Box>
        </>
      )}
    </VStack>
  );
}; 