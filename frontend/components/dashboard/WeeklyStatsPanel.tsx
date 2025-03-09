import { VStack, Box, HStack, Heading, Text } from "@chakra-ui/react";
import moment from "moment";
import { fetchSummaryData } from "../../lib/client";
import { useState } from "react";
import useSWR from "swr";
import { RadioButtons } from "./customRadio";
import { WeeklyVolumeGraph } from "./WeeklyVolumeGraph";
import { WeeklyVelocityGraph } from "./WeeklyVelocityGraph";

export const WeeklyStatsPanel = ({ userId }: { userId: any }) => {
  const [startDate, setStartDate] = useState(
    moment().subtract(6, 'months').toISOString()
  );
  const [endDate, setEndDate] = useState(moment().toISOString());

  const { data: activity = [], error } = useSWR(
    userId ? ["activity", userId, startDate, endDate, "activity"] : null,
    fetchSummaryData
  );

  const handleDateChange = (period: "6m" | "1y" | "2y") => {
    switch (period) {
      case "6m":
        setStartDate(moment().subtract(6, "months").toISOString());
        return;
      case "1y":
        setStartDate(moment().subtract(1, "year").toISOString());
        return;
      case "2y":
        setStartDate(moment().subtract(2, "years").toISOString());
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
      </VStack>

      <HStack width={"100%"} justifyContent={"flex-end"}>
        <RadioButtons
          options={["6m", "1y", "2y"]}
          defaultValue={"6m"}
          onChange={handleDateChange}
          selectedColor={"#8884d8"}
        />
      </HStack>

      <Box width={"100%"} height={"300px"}>
        <Heading size="sm" mb={2}>Weekly Volume (km)</Heading>
        <WeeklyVolumeGraph data={activity} />
      </Box>

      <Box width={"100%"} height={"300px"}>
        <Heading size="sm" mb={2}>Average Weekly Velocity (km/h)</Heading>
        <WeeklyVelocityGraph data={activity} />
      </Box>
    </VStack>
  );
}; 