import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class EmailService:
    """
    Service for sending emails via SMTP.
    Supports Gmail and other SMTP servers.
    """

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", self.smtp_user)
        self.admin_email = os.getenv("ADMIN_EMAIL", "")

    def _send_email(self, to_email: str, subject: str, body: str, is_html: bool = False) -> bool:
        """
        Send an email via SMTP.
        """
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured. Email not sent.")
            return False

        try:
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = to_email
            msg['Subject'] = subject

            if is_html:
                msg.attach(MIMEText(body, 'html'))
            else:
                msg.attach(MIMEText(body, 'plain'))

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def send_permission_request_notification(self, name: str, email: str, reason: str, timestamp: str) -> bool:
        """
        Send email notification to admin when a permission request is submitted.
        """
        if not self.admin_email:
            logger.warning("ADMIN_EMAIL not configured. Notification not sent.")
            return False

        subject = f"New Permission Request: {name}"
        body = f"""
A new permission request has been submitted:

Name: {name}
Email: {email}
Reason: {reason}
Timestamp: {timestamp}

Please review the request in the admin interface.
"""
        return self._send_email(self.admin_email, subject, body)

    def send_approval_email(self, user_email: str, user_name: str, password: str) -> bool:
        """
        Send approval email to user with their account credentials.
        """
        subject = "Your Style Transfer Account Has Been Approved"
        body = f"""
Hello {user_name},

Your permission request has been approved! Your account has been created.

Login Credentials:
Email: {user_email}
Password: {password}

You can now access the Neural Style Transfer application and create style transfers.

Please keep your password secure and do not share it with anyone.

Best regards,
Style Transfer Team
"""
        return self._send_email(user_email, subject, body)

    def send_rejection_email(self, user_email: str, user_name: str, reason: Optional[str] = None) -> bool:
        """
        Send rejection email to user.
        """
        subject = "Permission Request Status Update"
        body = f"""
Hello {user_name},

Thank you for your interest in the Neural Style Transfer application.

Unfortunately, your permission request has been declined at this time.
"""
        if reason:
            body += f"\nReason: {reason}\n"

        body += """
If you have any questions, please feel free to reach out.

Best regards,
Style Transfer Team
"""
        return self._send_email(user_email, subject, body)
