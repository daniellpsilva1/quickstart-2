import time
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models
from tenacity import retry, wait_exponential, stop_after_attempt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, requests_per_minute=30):
        self.requests_per_minute = requests_per_minute
        self.last_request_time = 0
        self.min_interval = 60.0 / requests_per_minute  # Time in seconds between requests
        
    def wait(self):
        """Wait if needed to comply with rate limits"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        
        if elapsed < self.min_interval:
            wait_time = self.min_interval - elapsed
            logger.info(f"Rate limit: Waiting {wait_time:.2f} seconds")
            time.sleep(wait_time)
            
        self.last_request_time = time.time()
        
class APIRequestScheduler:
    def __init__(self, db: Session, rate_limiter: RateLimiter):
        self.db = db
        self.rate_limiter = rate_limiter
    
    def schedule_request(self, user_id: str, data_type: str, start_date: datetime, end_date: datetime):
        """Schedule an API request for processing"""
        # Check if we already have a pending request for this range
        existing_request = (
            self.db.query(models.APIRequest)
            .filter(
                models.APIRequest.user_id == user_id,
                models.APIRequest.endpoint == data_type,
                models.APIRequest.start_date == start_date,
                models.APIRequest.end_date == end_date,
                models.APIRequest.status.in_(["pending", "in_progress"])
            )
            .first()
        )
        
        if existing_request:
            logger.info(f"Request already scheduled: {existing_request.id}")
            return existing_request
            
        # Create new request
        api_request = models.APIRequest(
            user_id=user_id,
            endpoint=data_type,
            start_date=start_date,
            end_date=end_date,
            status="pending"
        )
        
        self.db.add(api_request)
        self.db.commit()
        self.db.refresh(api_request)
        
        logger.info(f"New API request scheduled: {api_request.id}")
        return api_request
        
    def process_pending_requests(self):
        """Process pending API requests with rate limiting"""
        pending_requests = (
            self.db.query(models.APIRequest)
            .filter(models.APIRequest.status == "pending")
            .order_by(models.APIRequest.requested_at)
            .limit(10)  # Process in batches
            .all()
        )
        
        for request in pending_requests:
            try:
                request.status = "in_progress"
                self.db.commit()
                
                # Implement the actual API call here
                # This is just a placeholder - you'll need to implement the actual vital API call
                # self.fetch_and_store_data(request)
                
                request.status = "completed"
                request.completed_at = datetime.utcnow()
                self.db.commit()
                
            except Exception as e:
                logger.error(f"Error processing request {request.id}: {str(e)}")
                request.status = "failed"
                request.error_message = str(e)
                self.db.commit()
                
    @retry(wait=wait_exponential(multiplier=1, min=4, max=60), stop=stop_after_attempt(5))
    def fetch_and_store_data(self, request):
        """Placeholder for the actual data fetching implementation"""
        # This will be implemented in the API integration section
        pass 