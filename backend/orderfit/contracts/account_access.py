"""Account-access.v1 requests and safe public projections."""

from typing import Annotated, Literal

from pydantic import Field, SecretStr

from .primitives import DTO
from .resources import Email, Text

CapabilityState = Literal["available", "disabled", "unavailable"]
Token = Annotated[SecretStr, Field(min_length=32, max_length=512)]


class AccountAccessCapabilities(DTO):
    contract_version: Literal["account-access.v1"]
    email_verification: CapabilityState
    password_recovery: CapabilityState
    invitation_email: CapabilityState
    invitation_registration: CapabilityState


class VerificationRequest(DTO):
    current_password: SecretStr = Field(min_length=1, max_length=1024)


class TokenConfirm(DTO):
    token: Token


class PasswordResetRequest(DTO):
    email: Email


class PasswordResetConfirm(TokenConfirm):
    new_password: SecretStr = Field(min_length=12, max_length=1024)


class InvitationRegister(TokenConfirm):
    full_name: Text
    password: SecretStr = Field(min_length=12, max_length=1024)
