import type { NextPage } from "next";
import { VStack, Heading, Text, Box } from "@chakra-ui/react";
import { Card } from "../components/Card";
import { CreateUserVital } from "../components/CreateUserVital";
import { useState, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "../lib/client";
import { WeeklyStatsPanel } from "../components/dashboard/WeeklyStatsPanel";
import { DbStatusPanel } from "../components/dashboard/DbStatusPanel";

const Home: NextPage = () => {
  const [userID, setUserID] = useState<string | null>(null);
  const { data, mutate: refreshUsers } = useSWR("/users/", fetcher, {
    refreshInterval: 0, // Don't auto-refresh on interval
    revalidateOnFocus: false, // Don't refresh when window gets focus
  });

  const usersFiltered = data?.users ? data.users : [];

  // Callback to handle creating a user
  const handleCreateUser = useCallback((newUserId: string) => {
    setUserID(newUserId);
    refreshUsers(); // Refresh the user list when a new user is created
  }, [refreshUsers]);

  return (
    <VStack
      my={10}
      px={10}
      backgroundColor={"#fcfdff"}
      height={"100vh"}
      spacing={10}
      alignItems={"flex-start"}
    >
      <Heading size={"lg"} fontWeight={800}>
        Vital Quickstart
      </Heading>
      <VStack width={"100%"} alignItems={"flex-start"}>
        <Box width={"100%"}>
          <CreateUserVital
            users={usersFiltered}
            onCreate={handleCreateUser}
            onSelect={setUserID}
          />
        </Box>
        <Box width={"100%"}>
          <Card>
            <Heading size={"md"}>2. Visualize user data</Heading>
            <Text>
              Request user data and plot workout metrics over time.
            </Text>
            <Box width={"100%"}>
              <WeeklyStatsPanel userId={userID} />
            </Box>
          </Card>
        </Box>
        
        <Box width={"100%"} mt={4}>
          <Card>
            <Heading size={"md"}>Database Status</Heading>
            <Text>
              Monitor database connectivity and cached data statistics.
            </Text>
            <Box width={"100%"}>
              <DbStatusPanel />
            </Box>
          </Card>
        </Box>
      </VStack>
    </VStack>
  );
};

export default Home;
