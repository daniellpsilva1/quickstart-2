from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    client_user_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    workouts = relationship("Workout", back_populates="user")
    api_requests = relationship("APIRequest", back_populates="user")
    activities = relationship("Activity", back_populates="user")
    
class Workout(Base):
    __tablename__ = "workouts"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String, nullable=True)
    time_start = Column(DateTime, index=True)
    time_end = Column(DateTime)
    calendar_date = Column(String)
    calories = Column(Float, nullable=True)
    distance = Column(Float, nullable=True)  # in meters
    duration = Column(Integer, nullable=True)  # in minutes
    average_hr = Column(Float, nullable=True)
    max_hr = Column(Float, nullable=True)
    moving_time = Column(Integer, nullable=True)  # in seconds
    sport_data = Column(JSON, nullable=True)
    source_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON, nullable=True)  # Store the full raw data
    
    # Relationships
    user = relationship("User", back_populates="workouts")
    
class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(DateTime, index=True)
    calendar_date = Column(String)
    calories_total = Column(Float, nullable=True)
    calories_active = Column(Float, nullable=True)
    steps = Column(Integer, nullable=True)
    daily_movement = Column(Float, nullable=True)  # in meters
    low = Column(Integer, nullable=True)  # time in minutes
    medium = Column(Integer, nullable=True)  # time in minutes
    high = Column(Integer, nullable=True)  # time in minutes
    source_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON, nullable=True)  # Store the full raw data
    
    # Relationships
    user = relationship("User", back_populates="activities")
    
class APIRequest(Base):
    __tablename__ = "api_requests"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    endpoint = Column(String, index=True)  # workouts, sleep, activity, body
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String, index=True)  # pending, in_progress, completed, failed
    requested_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    items_fetched = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="api_requests")
    
class DateRangeStatus(Base):
    __tablename__ = "date_range_status"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    data_type = Column(String, index=True)  # workouts, sleep, activity, body
    start_date = Column(DateTime, index=True)
    end_date = Column(DateTime, index=True)
    is_complete = Column(Boolean, default=False)
    last_updated = Column(DateTime, default=datetime.utcnow) 