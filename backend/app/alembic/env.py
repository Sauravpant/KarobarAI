import sys
from os.path import abspath, dirname

backend_dir = dirname(dirname(dirname(abspath(__file__))))
sys.path.insert(0, backend_dir)

from logging.config import fileConfig

from sqlalchemy import create_engine
from sqlalchemy import pool

from alembic import context

from app.core.config import settings
from app.db.database import Base

from app.models.user import User
from app.models.shop import Shop
from app.models.product import Product
from app.models.category import Category
from app.models.credit_prediction import CreditPrediction
from app.models.customer import Customer
from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem
from app.models.credit_sale import CreditSale
from app.models.demand_forecast import DemandForecast

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:

    url = settings.DATABASE_URL

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:

    connectable = create_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
