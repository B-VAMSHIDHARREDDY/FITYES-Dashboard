"""users (dashboard sign-in)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-28 12:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.config import settings

revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = settings.effective_schema


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=200), nullable=True),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('user_id', name=op.f('uq_users_user_id')),
    schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_table('users', schema=SCHEMA)
