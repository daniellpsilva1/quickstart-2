from sqlalchemy.orm import Session
from database import SessionLocal
from rate_limiter import RateLimiter
from models import User, APIRequest, Workout, DateRangeStatus, Activity
from datetime import datetime, timedelta
import time
import logging
from vital import Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Vital client
VITAL_API_KEY = os.getenv("VITAL_API_KEY")
VITAL_ENVIRONMENT = os.getenv("VITAL_ENV")
VITAL_REGION = os.getenv("VITAL_REGION")

client = Client(api_key=VITAL_API_KEY, environment=VITAL_ENVIRONMENT, region=VITAL_REGION)

# Create rate limiter
rate_limiter = RateLimiter(requests_per_minute=30)  # Adjust based on Vital API limits

def process_api_requests():
    """Process pending API requests with rate limiting"""
    db = SessionLocal()
    try:
        # Get pending requests
        pending_requests = (
            db.query(APIRequest)
            .filter(APIRequest.status == "pending")
            .order_by(APIRequest.requested_at)
            .limit(5)  # Process in small batches
            .all()
        )
        
        if not pending_requests:
            logger.info("No pending requests to process")
            return
            
        logger.info(f"Processing {len(pending_requests)} pending requests")
        
        for request in pending_requests:
            try:
                # Update status to in_progress
                request.status = "in_progress"
                db.commit()
                
                # Format dates for API
                start_date_str = request.start_date.isoformat()
                end_date_str = request.end_date.isoformat()
                
                # Apply rate limiting
                rate_limiter.wait()
                
                # Fetch data from Vital API
                if request.endpoint == "workouts":
                    # Use pagination to get all workouts
                    all_workouts = []
                    items_count = 0
                    
                    # For large date ranges, split into smaller chunks
                    chunk_size = timedelta(days=90)  # 3 months at a time
                    current_start = request.start_date
                    
                    while current_start < request.end_date:
                        # Calculate the end of this chunk
                        current_end = min(current_start + chunk_size, request.end_date)
                        
                        # Format dates for API
                        chunk_start_str = current_start.isoformat()
                        chunk_end_str = current_end.isoformat()
                        
                        logger.info(f"Fetching workouts from {chunk_start_str} to {chunk_end_str}")
                        
                        # Apply rate limiting for each chunk
                        rate_limiter.wait()
                        
                        # Fetch this chunk of data
                        try:
                            chunk_data = client.Workouts.get(request.user_id, chunk_start_str, chunk_end_str)
                            
                            # Add workouts to our collection
                            if "workouts" in chunk_data and isinstance(chunk_data["workouts"], list):
                                chunk_workouts = chunk_data["workouts"]
                                all_workouts.extend(chunk_workouts)
                                items_count += len(chunk_workouts)
                                logger.info(f"Found {len(chunk_workouts)} workouts in chunk")
                        except Exception as chunk_error:
                            logger.error(f"Error fetching workout chunk: {str(chunk_error)}")
                        
                        # Move to next chunk
                        current_start = current_end
                    
                    # Create the response with all workouts
                    data = {"workouts": all_workouts}
                    logger.info(f"Total workouts fetched: {items_count}")
                    
                    store_workout_data(db, request.user_id, data)
                elif request.endpoint == "activity":
                    # Use pagination to get all activity data
                    all_activities = []
                    items_count = 0
                    
                    # For large date ranges, split into smaller chunks
                    chunk_size = timedelta(days=90)  # 3 months at a time
                    current_start = request.start_date
                    
                    while current_start < request.end_date:
                        # Calculate the end of this chunk
                        current_end = min(current_start + chunk_size, request.end_date)
                        
                        # Format dates for API
                        chunk_start_str = current_start.isoformat()
                        chunk_end_str = current_end.isoformat()
                        
                        logger.info(f"Fetching activities from {chunk_start_str} to {chunk_end_str}")
                        
                        # Apply rate limiting for each chunk
                        rate_limiter.wait()
                        
                        # Fetch this chunk of data
                        try:
                            chunk_data = client.Activity.get(request.user_id, chunk_start_str, chunk_end_str)
                            
                            # Add activities to our collection
                            if "activity" in chunk_data and isinstance(chunk_data["activity"], list):
                                chunk_activities = chunk_data["activity"]
                                all_activities.extend(chunk_activities)
                                items_count += len(chunk_activities)
                                logger.info(f"Found {len(chunk_activities)} activities in chunk")
                        except Exception as chunk_error:
                            logger.error(f"Error fetching activity chunk: {str(chunk_error)}")
                        
                        # Move to next chunk
                        current_start = current_end
                    
                    # Create the response with all activities
                    data = {"activity": all_activities}
                    logger.info(f"Total activities fetched: {items_count}")
                    
                    store_activity_data(db, request.user_id, data)
                else:
                    # Implement other data types as needed
                    items_count = 0
                    
                # Update request status
                request.status = "completed"
                request.completed_at = datetime.utcnow()
                request.items_fetched = items_count
                db.commit()
                
                # Update date range status
                update_date_range_status(db, request.user_id, request.endpoint, 
                                       request.start_date, request.end_date)
                
                logger.info(f"Completed request {request.id} with {items_count} items")
                
            except Exception as e:
                logger.error(f"Error processing request {request.id}: {str(e)}")
                request.status = "failed"
                request.error_message = str(e)
                db.commit()
                
    except Exception as e:
        logger.error(f"Error in process_api_requests: {str(e)}")
    finally:
        db.close()
        
def store_workout_data(db: Session, user_id: str, data: dict):
    """Store workout data in the database"""
    # Create user if it doesn't exist
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, client_user_id=user_id)
        db.add(user)
        db.commit()
    
    # Extract and store workouts
    count = 0
    if "workouts" in data and isinstance(data["workouts"], list):
        for workout_data in data["workouts"]:
            # Skip if workout already exists
            existing = db.query(Workout).filter(Workout.id == workout_data["id"]).first()
            if existing:
                continue
                
            # Parse dates
            time_start = datetime.fromisoformat(workout_data["time_start"].replace('Z', '+00:00')) if "time_start" in workout_data else None
            time_end = datetime.fromisoformat(workout_data["time_end"].replace('Z', '+00:00')) if "time_end" in workout_data else None
            
            # Create workout record
            workout = Workout(
                id=workout_data["id"],
                user_id=user_id,
                title=workout_data.get("title"),
                time_start=time_start,
                time_end=time_end,
                calendar_date=workout_data.get("calendar_date"),
                calories=workout_data.get("calories"),
                distance=workout_data.get("distance"),
                duration=workout_data.get("duration"),
                average_hr=workout_data.get("average_hr"),
                max_hr=workout_data.get("max_hr"),
                moving_time=workout_data.get("moving_time"),
                sport_data=workout_data.get("sport"),
                source_data=workout_data.get("source"),
                raw_data=workout_data
            )
            
            db.add(workout)
            count += 1
        
        db.commit()
    
    logger.info(f"Stored {count} new workout records for user {user_id}")
    
def store_activity_data(db: Session, user_id: str, data: dict):
    """Store activity data in the database"""
    # Create user if it doesn't exist
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, client_user_id=user_id)
        db.add(user)
        db.commit()
    
    # Extract and store activities
    count = 0
    if "activity" in data and isinstance(data["activity"], list):
        for activity_data in data["activity"]:
            # Skip if activity already exists
            existing = db.query(Activity).filter(Activity.id == activity_data["id"]).first()
            if existing:
                continue
                
            # Parse date
            activity_date = datetime.fromisoformat(activity_data["date"].replace('Z', '+00:00')) if "date" in activity_data else None
            
            # Create activity record
            activity = Activity(
                id=activity_data["id"],
                user_id=user_id,
                date=activity_date,
                calendar_date=activity_date.strftime("%Y-%m-%d") if activity_date else None,
                calories_total=activity_data.get("calories_total"),
                calories_active=activity_data.get("calories_active"),
                steps=activity_data.get("steps"),
                daily_movement=activity_data.get("daily_movement"),
                low=activity_data.get("low"),
                medium=activity_data.get("medium"),
                high=activity_data.get("high"),
                source_data=activity_data.get("source"),
                raw_data=activity_data
            )
            
            db.add(activity)
            count += 1
        
        db.commit()
    
    logger.info(f"Stored {count} new activity records for user {user_id}")

def update_date_range_status(db: Session, user_id: str, data_type: str, 
                           start_date: datetime, end_date: datetime):
    """Update the status of a date range to complete"""
    # Check if range already exists
    range_status = (
        db.query(DateRangeStatus)
        .filter(
            DateRangeStatus.user_id == user_id,
            DateRangeStatus.data_type == data_type,
            DateRangeStatus.start_date == start_date,
            DateRangeStatus.end_date == end_date
        )
        .first()
    )
    
    if range_status:
        range_status.is_complete = True
        range_status.last_updated = datetime.utcnow()
    else:
        range_status = DateRangeStatus(
            user_id=user_id,
            data_type=data_type,
            start_date=start_date,
            end_date=end_date,
            is_complete=True
        )
        db.add(range_status)
        
    db.commit()
    
def run_sync_service():
    """Main function to run the sync service"""
    logger.info("Starting data sync service")
    while True:
        try:
            process_api_requests()
        except Exception as e:
            logger.error(f"Error in sync service: {str(e)}")
        
        # Sleep between runs
        time.sleep(5)
        
if __name__ == "__main__":
    run_sync_service() 