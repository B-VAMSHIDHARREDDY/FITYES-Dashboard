"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-11-24 00:43:46.852405
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.config import settings

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = settings.effective_schema


def _t(target: str) -> str:
    return f"{SCHEMA}.{target}" if SCHEMA else target


def upgrade() -> None:
    op.create_table('agents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=200), nullable=False),
    sa.Column('phone', sa.String(length=40), nullable=True),
    sa.Column('title', sa.String(length=80), nullable=False),
    sa.Column('region', sa.String(length=80), nullable=False),
    sa.Column('avatar_color', sa.String(length=9), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_agents')),
    sa.UniqueConstraint('email', name=op.f('uq_agents_email')),
    schema=SCHEMA,
    )
    op.create_table('clients',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=200), nullable=True),
    sa.Column('phone', sa.String(length=40), nullable=True),
    sa.Column('kind', sa.Enum('buyer', 'seller', 'investor', name='client_kind', native_enum=False, length=32), nullable=False),
    sa.Column('pre_approved_amount', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_clients')),
    schema=SCHEMA,
    )
    op.create_table('market_snapshots',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('city', sa.String(length=80), nullable=False),
    sa.Column('neighborhood', sa.String(length=80), nullable=False),
    sa.Column('month', sa.Date(), nullable=False),
    sa.Column('median_price', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('price_per_sqm', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('inventory', sa.Integer(), nullable=False),
    sa.Column('new_listings', sa.Integer(), nullable=False),
    sa.Column('closed_sales', sa.Integer(), nullable=False),
    sa.Column('avg_days_on_market', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_market_snapshots')),
    sa.UniqueConstraint('neighborhood', 'month', name='uq_market_snapshots_hood_month'),
    schema=SCHEMA,
    )
    with op.batch_alter_table('market_snapshots', schema=SCHEMA) as batch_op:
        batch_op.create_index(batch_op.f('ix_market_snapshots_month'), ['month'], unique=False)

    op.create_table('properties',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('address', sa.String(length=200), nullable=False),
    sa.Column('city', sa.String(length=80), nullable=False),
    sa.Column('neighborhood', sa.String(length=80), nullable=False),
    sa.Column('state', sa.String(length=2), nullable=False),
    sa.Column('zip_code', sa.String(length=10), nullable=False),
    sa.Column('property_type', sa.Enum('single_family', 'condo', 'townhouse', 'multi_family', 'land', name='property_type', native_enum=False, length=32), nullable=False),
    sa.Column('status', sa.Enum('active', 'pending', 'sold', 'off_market', name='listing_status', native_enum=False, length=32), nullable=False),
    sa.Column('list_price', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('sold_price', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('bedrooms', sa.Integer(), nullable=False),
    sa.Column('bathrooms', sa.Numeric(precision=3, scale=1), nullable=False),
    sa.Column('area_sqm', sa.Integer(), nullable=False),
    sa.Column('plot_sqm', sa.Integer(), nullable=True),
    sa.Column('year_built', sa.Integer(), nullable=True),
    sa.Column('hoa_monthly', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('tax_annual', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('listed_at', sa.Date(), nullable=False),
    sa.Column('sold_at', sa.Date(), nullable=True),
    sa.Column('latitude', sa.Numeric(precision=9, scale=6, asdecimal=False), nullable=True),
    sa.Column('longitude', sa.Numeric(precision=9, scale=6, asdecimal=False), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], [_t('agents.id')], name=op.f('fk_properties_agent_id_agents'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_properties')),
    sa.UniqueConstraint('code', name=op.f('uq_properties_code')),
    schema=SCHEMA,
    )
    with op.batch_alter_table('properties', schema=SCHEMA) as batch_op:
        batch_op.create_index('ix_properties_list_price', ['list_price'], unique=False)
        batch_op.create_index(batch_op.f('ix_properties_neighborhood'), ['neighborhood'], unique=False)
        batch_op.create_index('ix_properties_status_city', ['status', 'city'], unique=False)

    op.create_table('deals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('property_id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('stage', sa.Enum('lead', 'viewing', 'offer', 'under_contract', 'closing', 'closed', 'lost', name='deal_stage', native_enum=False, length=32), nullable=False),
    sa.Column('stage_entered_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('target_close_date', sa.Date(), nullable=True),
    sa.Column('closed_at', sa.Date(), nullable=True),
    sa.Column('lost_reason', sa.String(length=200), nullable=True),
    sa.Column('channel', sa.String(length=40), nullable=False),
    sa.Column('financing', sa.String(length=40), nullable=False),
    sa.Column('offer_price', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('down_payment_pct', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('interest_rate', sa.Numeric(precision=5, scale=3), nullable=False),
    sa.Column('loan_term_years', sa.Integer(), nullable=False),
    sa.Column('commission_rate', sa.Numeric(precision=5, scale=4), nullable=False),
    sa.Column('offer_version', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], [_t('agents.id')], name=op.f('fk_deals_agent_id_agents'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['client_id'], [_t('clients.id')], name=op.f('fk_deals_client_id_clients'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['property_id'], [_t('properties.id')], name=op.f('fk_deals_property_id_properties'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_deals')),
    sa.UniqueConstraint('code', name=op.f('uq_deals_code')),
    schema=SCHEMA,
    )
    with op.batch_alter_table('deals', schema=SCHEMA) as batch_op:
        batch_op.create_index(batch_op.f('ix_deals_agent_id'), ['agent_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_deals_property_id'), ['property_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_deals_stage'), ['stage'], unique=False)

    op.create_table('activities',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.Enum('listing_created', 'price_change', 'stage_change', 'offer_updated', 'checklist', 'note', name='activity_kind', native_enum=False, length=32), nullable=False),
    sa.Column('message', sa.String(length=300), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=True),
    sa.Column('deal_id', sa.Integer(), nullable=True),
    sa.Column('property_id', sa.Integer(), nullable=True),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], [_t('agents.id')], name=op.f('fk_activities_agent_id_agents'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['deal_id'], [_t('deals.id')], name=op.f('fk_activities_deal_id_deals'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['property_id'], [_t('properties.id')], name=op.f('fk_activities_property_id_properties'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_activities')),
    schema=SCHEMA,
    )
    with op.batch_alter_table('activities', schema=SCHEMA) as batch_op:
        batch_op.create_index('ix_activities_created_at', ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_activities_deal_id'), ['deal_id'], unique=False)

    op.create_table('deal_checklist_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('deal_id', sa.Integer(), nullable=False),
    sa.Column('stage', sa.Enum('lead', 'viewing', 'offer', 'under_contract', 'closing', 'closed', 'lost', name='deal_stage', native_enum=False, length=32), nullable=False),
    sa.Column('kind', sa.Enum('check', 'question', name='checklist_kind', native_enum=False, length=32), nullable=False),
    sa.Column('code', sa.String(length=64), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('done', sa.Boolean(), nullable=False),
    sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['deal_id'], [_t('deals.id')], name=op.f('fk_deal_checklist_items_deal_id_deals'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_deal_checklist_items')),
    schema=SCHEMA,
    )
    with op.batch_alter_table('deal_checklist_items', schema=SCHEMA) as batch_op:
        batch_op.create_index(batch_op.f('ix_deal_checklist_items_deal_id'), ['deal_id'], unique=False)

    op.create_table('deal_stage_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('deal_id', sa.Integer(), nullable=False),
    sa.Column('stage', sa.Enum('lead', 'viewing', 'offer', 'under_contract', 'closing', 'closed', 'lost', name='deal_stage', native_enum=False, length=32), nullable=False),
    sa.Column('entered_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['deal_id'], [_t('deals.id')], name=op.f('fk_deal_stage_events_deal_id_deals'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_deal_stage_events')),
    schema=SCHEMA,
    )
    with op.batch_alter_table('deal_stage_events', schema=SCHEMA) as batch_op:
        batch_op.create_index(batch_op.f('ix_deal_stage_events_deal_id'), ['deal_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('deal_stage_events', schema=SCHEMA) as batch_op:
        batch_op.drop_index(batch_op.f('ix_deal_stage_events_deal_id'))

    op.drop_table(schema=SCHEMA, table_name='deal_stage_events')
    with op.batch_alter_table('deal_checklist_items', schema=SCHEMA) as batch_op:
        batch_op.drop_index(batch_op.f('ix_deal_checklist_items_deal_id'))

    op.drop_table(schema=SCHEMA, table_name='deal_checklist_items')
    with op.batch_alter_table('activities', schema=SCHEMA) as batch_op:
        batch_op.drop_index(batch_op.f('ix_activities_deal_id'))
        batch_op.drop_index('ix_activities_created_at')

    op.drop_table(schema=SCHEMA, table_name='activities')
    with op.batch_alter_table('deals', schema=SCHEMA) as batch_op:
        batch_op.drop_index(batch_op.f('ix_deals_stage'))
        batch_op.drop_index(batch_op.f('ix_deals_property_id'))
        batch_op.drop_index(batch_op.f('ix_deals_agent_id'))

    op.drop_table(schema=SCHEMA, table_name='deals')
    with op.batch_alter_table('properties', schema=SCHEMA) as batch_op:
        batch_op.drop_index('ix_properties_status_city')
        batch_op.drop_index(batch_op.f('ix_properties_neighborhood'))
        batch_op.drop_index('ix_properties_list_price')

    op.drop_table(schema=SCHEMA, table_name='properties')
    with op.batch_alter_table('market_snapshots', schema=SCHEMA) as batch_op:
        batch_op.drop_index(batch_op.f('ix_market_snapshots_month'))

    op.drop_table(schema=SCHEMA, table_name='market_snapshots')
    op.drop_table(schema=SCHEMA, table_name='clients')
    op.drop_table(schema=SCHEMA, table_name='agents')
