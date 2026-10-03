"""Core DB-backed tests on in-memory SQLite. Run from backend/: python -m unittest discover -s tests"""
import os
import unittest
import uuid
from datetime import date, timedelta

os.environ.setdefault("DATABASE_URL", "sqlite:///unused.db") 
os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.models import Category, Customer, CreditSale, Product, Shop
from app.models.enums import CreditStatus, LocationType, PaymentType, TransactionType
from app.schemas.auth import UserLoginRequest, UserRegisterRequest
from app.schemas.transaction import CreditSaleUpdateRequest, TransactionCreateRequest
from app.core.security import decode_access_token
from app.services import auth_service, transaction_service


@compiles(JSONB, "sqlite")
def _jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class CoreTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine, autoflush=False)()
        self.user = auth_service.register_user(
            self.db, UserRegisterRequest(full_name="Ram", email="ram@example.com", password="secret123")
        )
        self.shop = Shop(user_id=self.user.id, shop_name="Ram Kirana", address="Kathmandu",
                         location_type=LocationType.URBAN)
        cat = Category(name="Grains")
        self.db.add_all([self.shop, cat])
        self.db.flush()
        self.product = Product(shop_id=self.shop.id, category_id=cat.id, product_name="Rice", sku="RICE-1",
                               unit="kg", stock_quantity=10, cost_price=80, selling_price=100)
        self.customer = Customer(shop_id=self.shop.id, full_name="Hari", credit_limit=500,
                                 current_outstanding_balance=0, max_outstanding_ever=0)
        self.db.add_all([self.product, self.customer])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def sale(self, qty, payment=PaymentType.CASH, **kw):
        payload = TransactionCreateRequest(
            payment_type=payment, items=[{"product_id": self.product.id, "quantity": qty}], **kw
        )
        return transaction_service.create_transaction(self.db, self.user, self.shop.id, payload)

    def credit_sale(self, qty):
        return self.sale(qty, PaymentType.CREDIT, customer_id=self.customer.id,
                         due_date=date.today() + timedelta(days=7))

    def test_auth_duplicate_email_and_login(self):
        with self.assertRaises(HTTPException) as e:
            auth_service.register_user(
                self.db, UserRegisterRequest(full_name="X", email="ram@example.com", password="x")
            )
        self.assertEqual(e.exception.status_code, 409)

        with self.assertRaises(HTTPException) as e:
            auth_service.login_user(self.db, UserLoginRequest(email="ram@example.com", password="wrong"))
        self.assertEqual(e.exception.status_code, 401)

        res = auth_service.login_user(self.db, UserLoginRequest(email="ram@example.com", password="secret123"))
        self.assertEqual(decode_access_token(res.token.access_token)["sub"], str(self.user.id))

    def test_cash_sale_and_purchase_update_stock(self):
        tx = self.sale(3, discount=20)
        self.assertEqual(float(tx.subtotal), 300)
        self.assertEqual(float(tx.total_amount), 280)
        self.db.refresh(self.product)
        self.assertEqual(self.product.stock_quantity, 7)

        payload = TransactionCreateRequest(
            transaction_type=TransactionType.PURCHASE, payment_type=PaymentType.CASH,
            items=[{"product_id": self.product.id, "quantity": 5}],
        )
        tx = transaction_service.create_transaction(self.db, self.user, self.shop.id, payload)
        self.assertEqual(float(tx.total_amount), 400)  # purchases use cost price
        self.db.refresh(self.product)
        self.assertEqual(self.product.stock_quantity, 12)

    def test_insufficient_stock_rejected_without_side_effects(self):
        with self.assertRaises(HTTPException) as e:
            self.sale(11)
        self.assertEqual(e.exception.status_code, 400)
        self.db.rollback()
        self.db.refresh(self.product)
        self.assertEqual(self.product.stock_quantity, 10)

    def test_credit_sale_limit_and_repayment(self):
        self.credit_sale(3)
        self.db.refresh(self.customer)
        self.assertEqual(float(self.customer.current_outstanding_balance), 300)

        with self.assertRaises(HTTPException) as e:
            self.credit_sale(3)  # 300 + 300 > 500 limit
        self.assertEqual(e.exception.status_code, 400)
        self.db.rollback()

        cs = self.db.query(CreditSale).one()
        paid = CreditSaleUpdateRequest(status=CreditStatus.PAID)
        transaction_service.update_credit_sale(self.db, self.user, self.shop.id, cs.id, paid)
        transaction_service.update_credit_sale(self.db, self.user, self.shop.id, cs.id, paid)  # no double credit
        self.db.refresh(self.customer)
        self.assertEqual(float(self.customer.current_outstanding_balance), 0)
        self.assertEqual(float(self.customer.max_outstanding_ever), 300)

    def test_other_user_cannot_touch_shop(self):
        other = auth_service.register_user(
            self.db, UserRegisterRequest(full_name="Sita", email="sita@example.com", password="pw")
        )
        payload = TransactionCreateRequest(
            payment_type=PaymentType.CASH, items=[{"product_id": self.product.id, "quantity": 1}]
        )
        for shop_id in (self.shop.id, uuid.uuid4()):
            with self.assertRaises(HTTPException) as e:
                transaction_service.create_transaction(self.db, other, shop_id, payload)
            self.assertEqual(e.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
