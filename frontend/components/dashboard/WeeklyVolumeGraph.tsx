import React from "react";
import moment from "moment";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import _ from "lodash";

// Calculate weekly volume in kilometers from workout data
const calculateWeeklyVolume = (data: any[]) => {
  // Group data by week
  const groupedByWeek = _.groupBy(data, (item) => {
    return moment(item.time_start).startOf('week').format('YYYY-MM-DD');
  });

  // Convert to array of weekly data
  return Object.entries(groupedByWeek).map(([week, workouts]) => {
    // Sum up distances from workouts (in kilometers)
    const totalDistanceKm = _.sumBy(workouts, (workout) => {
      // Use the distance field if available, otherwise estimate from calories
      return workout.distance || (workout.calories ? workout.calories / 100 : 0);
    });
    
    return {
      week: moment(week).valueOf(),
      volumeKm: parseFloat(totalDistanceKm.toFixed(2)),
      year: moment(week).format('YYYY'),
      weekNumber: moment(week).format('W')
    };
  }).sort((a, b) => a.week - b.week);
};

export const WeeklyVolumeGraph: React.FunctionComponent<{ data: any[] }> = ({
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
          tickFormatter={(value: number) => `${value} km`}
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