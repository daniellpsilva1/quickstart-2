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
      // Make sure to apply proper scaling factor (1/100 of previous values)
      let distance = 0;
      
      if (typeof workout.distance === 'number') {
        // If distance exists, ensure it's in a reasonable range (1-100km per workout)
        distance = workout.distance > 100 ? workout.distance / 1000 : workout.distance;
      } else if (workout.calories) {
        // If only calories available, use a more conservative estimate
        distance = workout.calories / 10000;
      }
      
      return distance;
    });
    
    // Get start and end dates of this week
    const startDate = moment(week).format('MMM D');
    const endDate = moment(week).add(6, 'days').format('MMM D');
    
    return {
      week: moment(week).valueOf(),
      volumeKm: parseFloat(totalDistanceKm.toFixed(2)),
      year: moment(week).format('YYYY'),
      weekNumber: moment(week).format('W'),
      dateRange: `${startDate} - ${endDate}`
    };
  }).sort((a, b) => a.week - b.week);
};

export const WeeklyVolumeGraph: React.FunctionComponent<{ 
  data: any[],
  startDate?: string,
  endDate?: string
}> = ({
  data,
  startDate,
  endDate
}) => {
  // Calculate the weekly volume data
  const allWeeklyVolumeData = calculateWeeklyVolume(data);
  
  // Filter data based on start and end dates if provided
  const weeklyVolumeData = React.useMemo(() => {
    if (!startDate && !endDate) return allWeeklyVolumeData;
    
    const start = startDate ? moment(startDate).valueOf() : 0;
    const end = endDate ? moment(endDate).valueOf() : moment().valueOf();
    
    return allWeeklyVolumeData.filter(item => {
      return item.week >= start && item.week <= end;
    });
  }, [allWeeklyVolumeData, startDate, endDate]);
  
  // Function to format date label based on data density
  const formatDateLabel = (timestamp: number) => {
    const date = moment(timestamp);
    const totalWeeks = weeklyVolumeData.length;
    
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
      <LineChart data={weeklyVolumeData}>
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
          tickFormatter={(value: number) => `${value} km`}
        />
        <CartesianGrid vertical={false} />
        <Tooltip
          labelFormatter={(timestamp) => {
            const date = moment(timestamp);
            return `${date.format('MMM D')} - ${date.add(6, 'days').format('MMM D')}, ${date.format('YYYY')}`;
          }}
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