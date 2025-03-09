import React from "react";
import moment from "moment";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import _ from "lodash";
import { Activity } from "../../models";

// Calculate weekly volume in kilometers
const calculateWeeklyVolume = (data: Activity[]) => {
  // Group data by week
  const groupedByWeek = _.groupBy(data, (item) => {
    return moment(item.date).startOf('week').format('YYYY-MM-DD');
  });

  // Convert to array of weekly data
  return Object.entries(groupedByWeek).map(([week, activities]) => {
    // Sum up distances (converted from meters to kilometers)
    // For this demo, we'll simulate distance by using calories_total divided by 100 as kilometers
    const totalDistanceKm = _.sumBy(activities, (activity) => activity.calories_total / 100);
    
    return {
      week: moment(week).valueOf(),
      volumeKm: parseFloat(totalDistanceKm.toFixed(2)),
      year: moment(week).format('YYYY'),
      weekNumber: moment(week).format('W')
    };
  }).sort((a, b) => a.week - b.week);
};

export const WeeklyVolumeGraph: React.FunctionComponent<{ data: Activity[] }> = ({
  data,
}) => {
  const weeklyVolumeData = calculateWeeklyVolume(data);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={weeklyVolumeData}>
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
          tickFormatter={(value) => `${value} km`}
        />
        <CartesianGrid vertical={false} />
        <Tooltip
          labelFormatter={(timestamp) => `Week ${moment(timestamp).format('W')} - ${moment(timestamp).format('YYYY')}`}
          formatter={(value: number) => [`${value} km`, 'Weekly Volume']}
          labelStyle={{ fontSize: 12, color: "gray" }}
          contentStyle={{ borderRadius: 10 }}
        />
        <Line
          type="monotone"
          dataKey="volumeKm"
          stroke="#8884d8"
          fill="#8884d8"
          strokeWidth={2}
          dot={{ stroke: '#8884d8', strokeWidth: 2, r: 4 }}
          activeDot={{ stroke: '#8884d8', strokeWidth: 2, r: 6 }}
          name="Weekly Volume"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}; 