"""client address + invoice paid date

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-28 01:30:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.config import settings

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = settings.effective_schema


def upgrade() -> None:
    with op.batch_alter_table('clients', schema=SCHEMA) as batch:
        batch.add_column(sa.Column('street', sa.String(length=200), nullable=True))
        batch.add_column(sa.Column('postal_code', sa.String(length=10), nullable=True))
        batch.add_column(sa.Column('city', sa.String(length=80), nullable=True))
        batch.add_column(sa.Column('invoice_paid_at', sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('clients', schema=SCHEMA) as batch:
        batch.drop_column('invoice_paid_at')
        batch.drop_column('city')
        batch.drop_column('postal_code')
        batch.drop_column('street')
