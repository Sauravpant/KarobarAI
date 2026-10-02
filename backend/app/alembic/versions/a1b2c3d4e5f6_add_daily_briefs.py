from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '96d32b589f73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('daily_briefs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('shop_id', sa.Uuid(), nullable=False),
    sa.Column('brief_date', sa.Date(), nullable=False),
    sa.Column('transcript', sa.Text(), nullable=False),
    sa.Column('context', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('audio', sa.LargeBinary(), nullable=True),
    sa.Column('generated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('shop_id', 'brief_date', name='uq_daily_briefs_shop_date')
    )

def downgrade() -> None:
    op.drop_table('daily_briefs')
