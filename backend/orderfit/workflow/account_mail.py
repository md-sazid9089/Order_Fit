"""One bounded mail claim per business-worker tick; never holds SQL across HTTP."""

import logging
import secrets

from orderfit.services.mail_crypto import MailCipher
from orderfit.services.resend import ResendTransport
from orderfit.store import account_access_repository as repo

LOG = logging.getLogger("orderfit.account_mail")


def run_mail_once(database, config, transport=None):
    if not config.account_email_worker_enabled or config.account_email_mode == "off":
        return False
    with database.transaction() as c:
        row = repo.call(c, "claim")
    if row is None:
        return False
    try:
        payload = MailCipher(config).decrypt(row)
    except Exception:
        status, provider, delay = "rejected", None, 1
    else:
        with database.transaction() as c:
            valid = repo.call(c, "valid", id=row["id"], fence=row["lease_token"])
        if not valid:
            status, provider, delay = "cancelled", None, 1
        elif transport is not None:
            status, provider, delay = transport.send(payload, row["provider_key"])
        elif config.account_email_mode == "recorded":
            status, provider, delay = "accepted", "recorded-" + str(row["id"]), 1
        else:
            status, provider, delay = ResendTransport(config).send(payload, row["provider_key"])
    if status == "retry":
        delay = max(delay, min(3600, 2 ** row["attempts"] + secrets.randbelow(10)))
    with database.transaction() as c:
        published = repo.call(
            c,
            "publish",
            id=row["id"],
            fence=row["lease_token"],
            status=status,
            provider=provider,
            delay=delay,
        )
    LOG.info("account_mail_result id=%s outcome=%s published=%s", row["id"], status, published)
    return True
