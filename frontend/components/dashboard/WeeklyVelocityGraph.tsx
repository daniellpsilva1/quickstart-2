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

// Calculate average weekly velocity (km/h)
const calculateWeeklyVelocity = (data: any[]) => {
  // Group data by week
  const groupedByWeek = _.groupBy(data, (item) => {
    return moment(item.time_start).startOf('week').format('YYYY-MM-DD');
  });

  // Convert to array of weekly data
  return Object.entries(groupedByWeek).map(([week, workouts]) => {
    // For real workout data, we calculate velocity as distance/time (km/h)
    
    let totalDistance = 0;
    let totalDurationHours = 0;
    
    workouts.forEach(workout => {
      // Get distance with proper scaling
      let distance = 0;
      if (typeof workout.distance === 'number') {
        // If distance exists, ensure it's in a reasonable range (1-100km per workout)
        distance = workout.distance > 100 ? workout.distance / 1000 : workout.distance;
      } else if (workout.calories) {
        // If only calories available, use a more conservative estimate
        distance = workout.calories / 10000;
      }
      
      // Get duration in hours
      let durationHours = 0;
      if (workout.duration) {
        // If duration is in minutes, convert to hours
        durationHours = workout.duration / 60;
      } else if (workout.time_start && workout.time_end) {
        // Calculate from start/end times
        const startTime = moment(workout.time_start);
        const endTime = moment(workout.time_end);
        durationHours = endTime.diff(startTime, 'hours', true);
      }
      
      // Only count if we have both distance and duration
      if (distance > 0 && durationHours > 0) {
        totalDistance += distance;
        totalDurationHours += durationHours;
      }
    });
    
    // Calculate average velocity (km/h)
    let avgVelocity = 0;
    if (totalDurationHours > 0) {
      avgVelocity = totalDistance / totalDurationHours;
      
      // Sanity check for unreasonable values
      if (avgVelocity > 50) {
        avgVelocity = 50; // Cap at 50 km/h which is still very fast
      }
    }
    
    // Get start and end dates of this week
    const startDate = moment(week).format('MMM D');
    const endDate = moment(week).add(6, 'days').format('MMM D');
    
    return {
      week: moment(week).valueOf(),
      velocityKmh: parseFloat(avgVelocity.toFixed(2)),
      year: moment(week).format('YYYY'),
      weekNumber: moment(week).format('W'),
      dateRange: `${startDate} - ${endDate}`,
      workoutCount: workouts.length
    };
  }).sort((a, b) => a.week - b.week);
};

export const WeeklyVelocityGraph: React.FunctionComponent<{ 
  data: any[],
  startDate?: string,
  endDate?: string
}> = ({
  data,
  startDate,
  endDate
}) => {
  // Calculate the weekly velocity data
  const allWeeklyVelocityData = calculateWeeklyVelocity(data);
  
  // Filter data based on start and end dates if provided
  const weeklyVelocityData = React.useMemo(() => {
    if (!startDate && !endDate) return allWeeklyVelocityData;
    
    const start = startDate ? moment(startDate).valueOf() : 0;
    const end = endDate ? moment(endDate).valueOf() : moment().valueOf();
    
    return allWeeklyVelocityData.filter(item => {
      return item.week >= start && item.week <= end;
    });
  }, [allWeeklyVelocityData, startDate, endDate]);
  
  // Function to format date label based on data density
  const formatDateLabel = (timestamp: number) => {
    const date = moment(timestamp);
    const totalWeeks = weeklyVelocityData.length;
    
    // For sparse data (few weeks), show more details
    if (totalWeeks <= 6) {
      return `${date.format('MMM D')} - ${date.add(6, 'days').format('MMM D')}`;
    }
    // For moderate data density, show month and week
    else if (totalWeeks <= 15) {
      return `${date.format('MMM')} W${date.format('W')}`;
    }
    // For very dense data, just show month or simplified format
    else {
      return date.format('MMM D');
    }
  };
  
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
          tickFormatter={formatDateLabel}
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
          labelFormatter={(timestamp) => {
            const date = moment(timestamp);
            return `${date.format('MMM D')} - ${date.add(6, 'days').format('MMM D')}, ${date.format('YYYY')}`;
          }}
          formatter={(value: number, name: string) => {
            if (name === 'velocityKmh') {
              return [`${value} km/h`, 'Average Velocity'];
            }
            return [value, name];
          }}
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