from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '96d32b589f73'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('categories',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('full_name', sa.String(length=100), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('shops',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('shop_name', sa.String(length=150), nullable=False),
    sa.Column('address', sa.Text(), nullable=False),
    sa.Column('location_type', sa.Enum('URBAN', 'SEMI_URBAN', 'RURAL', name='locationtype'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_shops_user_id', 'shops', ['user_id'], unique=False)
    op.create_table('customers',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('shop_id', sa.Uuid(), nullable=False),
    sa.Column('full_name', sa.String(length=120), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('credit_limit', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('current_outstanding_balance', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('max_outstanding_ever', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_customers_shop_active', 'customers', ['shop_id', 'is_active'], unique=False)
    op.create_table('products',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('shop_id', sa.Uuid(), nullable=False),
    sa.Column('category_id', sa.Uuid(), nullable=False),
    sa.Column('product_name', sa.String(length=150), nullable=False),
    sa.Column('sku', sa.String(length=50), nullable=False),
    sa.Column('barcode', sa.String(length=100), nullable=True),
    sa.Column('unit', sa.String(length=20), nullable=False),
    sa.Column('stock_quantity', sa.Integer(), nullable=False),
    sa.Column('cost_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('selling_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('reorder_level', sa.Integer(), nullable=False),
    sa.Column('is_staple', sa.Boolean(), nullable=False),
    sa.Column('is_perishable', sa.Boolean(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('sku')
    )
    op.create_index('ix_products_shop_active', 'products', ['shop_id', 'is_active'], unique=False)
    op.create_table('credit_predictions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('customer_id', sa.Uuid(), nullable=False),
    sa.Column('risk_probability', sa.Numeric(precision=5, scale=4), nullable=False),
    sa.Column('risk_level', sa.Enum('LOW', 'MEDIUM', 'HIGH', name='risklevel'), nullable=False),
    sa.Column('recommended_credit_limit', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('model_version', sa.String(length=50), nullable=False),
    sa.Column('generated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('demand_forecasts',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('shop_id', sa.Uuid(), nullable=False),
    sa.Column('product_id', sa.Uuid(), nullable=True),
    sa.Column('forecast_date', sa.Date(), nullable=False),
    sa.Column('predicted_quantity', sa.Integer(), nullable=False),
    sa.Column('confidence_score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('model_version', sa.String(length=50), nullable=False),
    sa.Column('generated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('transactions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('shop_id', sa.Uuid(), nullable=False),
    sa.Column('customer_id', sa.Uuid(), nullable=True),
    sa.Column('transaction_type', sa.Enum('SALE', 'PURCHASE', name='transactiontype'), nullable=False),
    sa.Column('payment_type', sa.Enum('CASH', 'CREDIT', 'QR', name='paymenttype'), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('discount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transactions_customer_id', 'transactions', ['customer_id'], unique=False)
    op.create_index('ix_transactions_shop_created', 'transactions', ['shop_id', 'created_at'], unique=False)
    op.create_index('ix_transactions_shop_payment', 'transactions', ['shop_id', 'payment_type'], unique=False)
    op.create_index('ix_transactions_shop_type', 'transactions', ['shop_id', 'transaction_type'], unique=False)
    op.create_table('credit_sales',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('transaction_id', sa.Uuid(), nullable=False),
    sa.Column('customer_id', sa.Uuid(), nullable=False),
    sa.Column('credit_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('due_date', sa.Date(), nullable=False),
    sa.Column('paid_at', sa.DateTime(), nullable=True),
    sa.Column('status', sa.Enum('PAID', 'UNPAID', 'OVERDUE', name='creditstatus'), nullable=False),
    sa.Column('remarks', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
    sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('transaction_id')
    )
    op.create_index('ix_credit_sales_customer_status', 'credit_sales', ['customer_id', 'status'], unique=False)
    op.create_table('transaction_items',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('transaction_id', sa.Uuid(), nullable=False),
    sa.Column('product_id', sa.Uuid(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_txn_items_product_id', 'transaction_items', ['product_id'], unique=False)
    op.create_index('ix_txn_items_transaction_id', 'transaction_items', ['transaction_id'], unique=False)

def downgrade() -> None:
    op.drop_index('ix_txn_items_transaction_id', table_name='transaction_items')
    op.drop_index('ix_txn_items_product_id', table_name='transaction_items')
    op.drop_table('transaction_items')
    op.drop_index('ix_credit_sales_customer_status', table_name='credit_sales')
    op.drop_table('credit_sales')
    op.drop_index('ix_transactions_shop_type', table_name='transactions')
    op.drop_index('ix_transactions_shop_payment', table_name='transactions')
    op.drop_index('ix_transactions_shop_created', table_name='transactions')
    op.drop_index('ix_transactions_customer_id', table_name='transactions')
    op.drop_table('transactions')
    op.drop_table('demand_forecasts')
    op.drop_table('credit_predictions')
    op.drop_index('ix_products_shop_active', table_name='products')
    op.drop_table('products')
    op.drop_index('ix_customers_shop_active', table_name='customers')
    op.drop_table('customers')
    op.drop_index('ix_shops_user_id', table_name='shops')
    op.drop_table('shops')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('categories')

