import { VStack, Box, HStack, Heading, Text, Spinner, Alert, AlertIcon, Center } from "@chakra-ui/react";
import moment from "moment";
import { fetchSummaryData } from "../../lib/client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { RadioButtons } from "./customRadio";
import { WeeklyVolumeGraph } from "./WeeklyVolumeGraph";
import { WeeklyVelocityGraph } from "./WeeklyVelocityGraph";

export const WeeklyStatsPanel = ({ userId }: { userId: any }) => {
  const [startDate, setStartDate] = useState(
    moment().subtract(6, 'months').toISOString()
  );
  const [endDate, setEndDate] = useState(moment().toISOString());

  // Reset data fetching when userId changes
  useEffect(() => {
    console.log("User ID changed to:", userId);
  }, [userId]);

  const { data: activity = [], error, isValidating } = useSWR(
    userId ? ["activity", userId, startDate, endDate, "activity"] : null,
    fetchSummaryData,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      onSuccess: (data) => {
        console.log("Data fetched successfully:", data?.length || 0, "records");
      },
      onError: (err) => {
        console.error("Error fetching data:", err);
      }
    }
  );

  const handleDateChange = (period: "1w" | "1m" | "6m" | "1y" | "2y" | "5y") => {
    switch (period) {
      case "1w":
        setStartDate(moment().subtract(1, "week").toISOString());
        return;
      case "1m":
        setStartDate(moment().subtract(1, "month").toISOString());
        return;
      case "6m":
        setStartDate(moment().subtract(6, "months").toISOString());
        return;
      case "1y":
        setStartDate(moment().subtract(1, "year").toISOString());
        return;
      case "2y":
        setStartDate(moment().subtract(2, "years").toISOString());
        return;
      case "5y":
        setStartDate(moment().subtract(5, "years").toISOString());
        return;
      default:
        return;
    }
  };

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
        {userId && <Text fontSize="xs" color="blue.500">Selected user ID: {userId}</Text>}
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
          Error loading data. Please try again.
        </Alert>
      )}

      {userId && !isValidating && activity.length === 0 && (
        <Alert status="info" rounded="md">
          <AlertIcon />
          No activity data found for this user in the selected time period.
        </Alert>
      )}

      {userId && activity.length > 0 && (
        <>
          <Box width={"100%"} height={"300px"}>
            <Heading size="sm" mb={2}>Weekly Volume (km)</Heading>
            <WeeklyVolumeGraph data={activity} />
          </Box>

          <Box width={"100%"} height={"300px"}>
            <Heading size="sm" mb={2}>Average Weekly Velocity (km/h)</Heading>
            <WeeklyVelocityGraph data={activity} />
          </Box>
        </>
      )}
    </VStack>
  );
}; 