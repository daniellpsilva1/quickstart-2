import React from "react";
import moment from "moment";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import _ from "lodash";
import { Activity } from "../../models";

// Calculate average weekly velocity
const calculateWeeklyVelocity = (data: Activity[]) => {
  // Group data by week
  const groupedByWeek = _.groupBy(data, (item) => {
    return moment(item.date).startOf('week').format('YYYY-MM-DD');
  });

  // Convert to array of weekly data
  return Object.entries(groupedByWeek).map(([week, activities]) => {
    // For this demo, we'll simulate velocity by using a random formula based on activity intensity
    // In a real app, velocity would be distance/time but we don't have that exact data
    // We'll use average of (high activity * 15 + medium activity * 10 + low activity * 5) / totalActivityTime
    
    const totalHighMinutes = _.sumBy(activities, 'high');
    const totalMediumMinutes = _.sumBy(activities, 'medium');
    const totalLowMinutes = _.sumBy(activities, 'low');
    
    const totalActivityTime = totalHighMinutes + totalMediumMinutes + totalLowMinutes;
    
    // Calculate weighted velocity in km/h
    let avgVelocity = 0;
    if (totalActivityTime > 0) {
      avgVelocity = ((totalHighMinutes * 15) + (totalMediumMinutes * 10) + (totalLowMinutes * 5)) / totalActivityTime;
    }
    
    return {
      week: moment(week).valueOf(),
      velocityKmh: parseFloat(avgVelocity.toFixed(2)),
      year: moment(week).format('YYYY'),
      weekNumber: moment(week).format('W')
    };
  }).sort((a, b) => a.week - b.week);
};

export const WeeklyVelocityGraph: React.FunctionComponent<{ data: Activity[] }> = ({
  data,
}) => {
  const weeklyVelocityData = calculateWeeklyVelocity(data);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={weeklyVelocityData}>
        <XAxis
          axisLine={false}
          dataKey="week"
          type="number"
          scale="time"
          domain={["auto", "auto"]}
          tickLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(timestamp) => {
            return `Week ${moment(timestamp).format('W')} - ${moment(timestamp).format('YYYY')}`;
          }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 14 }}
          domain={[0, 'auto']}
          tickFormatter={(value: number) => `${value} km/h`}
        />
        <CartesianGrid vertical={false} />
        <Tooltip
          labelFormatter={(timestamp) => `Week ${moment(timestamp).format('W')} - ${moment(timestamp).format('YYYY')}`}
          formatter={(value: number) => [`${value} km/h`, 'Average Velocity']}
          labelStyle={{ fontSize: 12, color: "gray" }}
          contentStyle={{ borderRadius: 10 }}
        />
        <Line
          type="monotone"
          dataKey="velocityKmh"
          stroke="#82ca9d"
          fill="#82ca9d"
          strokeWidth={2}
          dot={{ stroke: '#82ca9d', strokeWidth: 2, r: 4 }}
          activeDot={{ stroke: '#82ca9d', strokeWidth: 2, r: 6 }}
          name="Average Velocity"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}; 