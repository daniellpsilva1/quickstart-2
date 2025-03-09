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
} from "recharts";
import _ from "lodash";

// Calculate average weekly workout intensity
const calculateWeeklyIntensity = (data: any[]) => {
  // Group data by week
  const groupedByWeek = _.groupBy(data, (item) => {
    return moment(item.time_start).startOf('week').format('YYYY-MM-DD');
  });

  // Convert to array of weekly data
  return Object.entries(groupedByWeek).map(([week, workouts]) => {
    // For real workout data, we can calculate actual intensity metrics
    // We'll use distance divided by duration (in hours) to get km/h
    
    let totalDistance = 0;
    let totalDurationHours = 0;
    
    workouts.forEach(workout => {
      // Get distance
      const distance = workout.distance || (workout.calories ? workout.calories / 100 : 0);
      
      // Get duration in hours
      let durationHours = 0;
      if (workout.duration) {
        // If duration is in minutes
        durationHours = workout.duration / 60;
      } else if (workout.time_start && workout.time_end) {
        // Calculate from start/end times
        const startTime = moment(workout.time_start);
        const endTime = moment(workout.time_end);
        durationHours = endTime.diff(startTime, 'hours', true);
      }
      
      totalDistance += distance;
      totalDurationHours += durationHours;
    });
    
    // Calculate average intensity (km/h)
    let avgIntensity = 0;
    if (totalDurationHours > 0) {
      avgIntensity = totalDistance / totalDurationHours;
    }
    
    return {
      week: moment(week).valueOf(),
      intensityKmh: parseFloat(avgIntensity.toFixed(2)),
      year: moment(week).format('YYYY'),
      weekNumber: moment(week).format('W'),
      workoutCount: workouts.length
    };
  }).sort((a, b) => a.week - b.week);
};

export const WeeklyVelocityGraph: React.FunctionComponent<{ data: any[] }> = ({
  data,
}) => {
  const weeklyIntensityData = calculateWeeklyIntensity(data);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={weeklyIntensityData}>
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
          formatter={(value: number, name: string) => {
            if (name === 'intensityKmh') {
              return [`${value} km/h`, 'Average Intensity'];
            }
            return [value, name];
          }}
          labelStyle={{ fontSize: 12, color: "gray" }}
          contentStyle={{ borderRadius: 10 }}
        />
        <Line
          type="monotone"
          dataKey="intensityKmh"
          stroke="#82ca9d"
          fill="#82ca9d"
          strokeWidth={2}
          dot={{ stroke: '#82ca9d', strokeWidth: 2, r: 4 }}
          activeDot={{ stroke: '#82ca9d', strokeWidth: 2, r: 6 }}
          name="Average Intensity"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}; 