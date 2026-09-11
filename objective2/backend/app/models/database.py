from datetime import datetime
import json
from sqlalchemy import Column, String, DateTime, Text, Integer
from ..database.session import Base

class ProjectRecord(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    version = Column(String, default="1.0.0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    architecture_json = Column(Text, nullable=False)

class AnalysisRecord(Base):
    __tablename__ = "analysis_runs"

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, index=True)
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    critical_count = Column(Integer, default=0)
    high_risk_count = Column(Integer, default=0)
    spof_count = Column(Integer, default=0)
    complexity_rating = Column(String, default="MEDIUM")
    result_json = Column(Text, nullable=False)
