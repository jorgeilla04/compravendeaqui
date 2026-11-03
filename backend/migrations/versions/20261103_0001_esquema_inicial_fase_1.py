"""esquema inicial fase 1: usuarios, auth OTP, categorías, avisos e imágenes.

Revision ID: 0001
Revises:
Create Date: 2026-11-03 07:40:15.315752

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Extensiones (idempotente; también las crea infrastructure/postgres/init.sql).
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "categories",
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["categories.id"],
            name=op.f("fk_categories_parent_id_categories"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("slug", name=op.f("uq_categories_slug")),
    )
    op.create_index(
        op.f("ix_categories_parent_id"), "categories", ["parent_id"], unique=False
    )
    op.create_table(
        "otp_codes",
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_otp_codes")),
    )
    op.create_index("idx_otp_phone", "otp_codes", ["phone", "purpose"], unique=False)
    op.create_table(
        "users",
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("phone_verified", sa.Boolean(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("whatsapp_optin", sa.Boolean(), nullable=False),
        sa.Column("profile_pending", sa.Boolean(), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("phone", name=op.f("uq_users_phone")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
    )
    op.create_table(
        "listings",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("price_currency", sa.String(length=3), nullable=False),
        sa.Column("price_usd_ref", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column(
            "fx_rate_at_publish", sa.Numeric(precision=14, scale=4), nullable=True
        ),
        sa.Column("condition", sa.String(length=50), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("views_count", sa.Integer(), nullable=False),
        sa.Column("contacts_count", sa.Integer(), nullable=False),
        sa.Column("is_featured", sa.Boolean(), nullable=False),
        sa.Column("featured_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_listings_category_id_categories"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_listings_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_listings")),
        sa.UniqueConstraint("slug", name=op.f("uq_listings_slug")),
    )
    op.create_index(
        "idx_listings_created",
        "listings",
        [sa.literal_column("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "idx_listings_search",
        "listings",
        ["search_vector"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "idx_listings_status",
        "listings",
        ["status"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_listings_title_trgm",
        "listings",
        ["title"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"title": "gin_trgm_ops"},
    )
    op.create_index(
        op.f("ix_listings_category_id"), "listings", ["category_id"], unique=False
    )
    op.create_index(
        op.f("ix_listings_department"), "listings", ["department"], unique=False
    )
    op.create_index(op.f("ix_listings_user_id"), "listings", ["user_id"], unique=False)
    op.create_table(
        "refresh_tokens",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(
        op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False
    )
    op.create_table(
        "listing_images",
        sa.Column("listing_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("thumb_url", sa.Text(), nullable=True),
        sa.Column("storage_key", sa.Text(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            name=op.f("fk_listing_images_listing_id_listings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_listing_images")),
    )
    op.create_index(
        op.f("ix_listing_images_listing_id"),
        "listing_images",
        ["listing_id"],
        unique=False,
    )

    # search_vector: título (peso A) + descripción (peso B), en español y sin
    # tildes. La query usa la misma normalización (ver services/search.py).
    op.execute(
        """
        CREATE FUNCTION listings_search_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW.search_vector :=
            setweight(to_tsvector('spanish', unaccent(coalesce(NEW.title, ''))), 'A')
            || setweight(
              to_tsvector('spanish', unaccent(coalesce(NEW.description, ''))), 'B'
            );
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_listings_search_vector
        BEFORE INSERT OR UPDATE OF title, description ON listings
        FOR EACH ROW EXECUTE FUNCTION listings_search_vector_update()
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS trg_listings_search_vector ON listings")
    op.execute("DROP FUNCTION IF EXISTS listings_search_vector_update()")
    op.drop_index(op.f("ix_listing_images_listing_id"), table_name="listing_images")
    op.drop_table("listing_images")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index(op.f("ix_listings_user_id"), table_name="listings")
    op.drop_index(op.f("ix_listings_department"), table_name="listings")
    op.drop_index(op.f("ix_listings_category_id"), table_name="listings")
    op.drop_index(
        "idx_listings_title_trgm",
        table_name="listings",
        postgresql_using="gin",
        postgresql_ops={"title": "gin_trgm_ops"},
    )
    op.drop_index(
        "idx_listings_status",
        table_name="listings",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index("idx_listings_search", table_name="listings", postgresql_using="gin")
    op.drop_index("idx_listings_created", table_name="listings")
    op.drop_table("listings")
    op.drop_table("users")
    op.drop_index("idx_otp_phone", table_name="otp_codes")
    op.drop_table("otp_codes")
    op.drop_index(op.f("ix_categories_parent_id"), table_name="categories")
    op.drop_table("categories")
