import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.llm.factory import get_llm_provider
from db.database import get_db
from db.models import Review

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    name: str
    description: Optional[str] = None
    osf_url: Optional[str] = None


class ReviewOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    osf_url: Optional[str]
    llm_provider: Optional[str]
    llm_model: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ReviewOut])
async def list_reviews(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Review).order_by(Review.created_at.desc()))
    return result.scalars().all()


@router.get("/{review_id}", response_model=ReviewOut)
async def get_review(review_id: int, db: AsyncSession = Depends(get_db)):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.post("/", response_model=ReviewOut, status_code=201)
async def create_review(body: ReviewCreate, db: AsyncSession = Depends(get_db)):
    provider = get_llm_provider()
    review = Review(
        name=body.name,
        description=body.description,
        osf_url=body.osf_url,
        llm_provider=provider.provider_name,
        llm_model=provider.model_name,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


@router.patch("/{review_id}", response_model=ReviewOut)
async def update_review(review_id: int, body: ReviewCreate, db: AsyncSession = Depends(get_db)):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    await db.commit()
    await db.refresh(review)
    return review
