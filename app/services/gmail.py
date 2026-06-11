import imaplib
import email
from email.header import decode_header
import logging
from typing import List, Dict
from app.database.connection import get_db_for_mode
from app.database.models import Setting

logger = logging.getLogger(__name__)

def get_gmail_credentials(mode: str = "work") -> tuple[str, str]:
    db = get_db_for_mode(mode)
    try:
        addr = db.query(Setting).filter(Setting.key == "gmail_address").first()
        pw = db.query(Setting).filter(Setting.key == "gmail_app_password").first()
        return (addr.value if addr else "", pw.value if pw else "")
    finally:
        db.close()

async def get_recent_emails(max_results: int = 5, mode: str = "work") -> List[Dict[str, str]]:
    email_address, app_password = get_gmail_credentials(mode)
    
    if not email_address or not app_password:
        return [
            {
                "from": "Workspace System",
                "subject": "Gmail Integration Onboarding",
                "date": "Today",
                "snippet": "Gmail credentials are not configured yet. Go to the Settings tab to link your Gmail address and Google App Password."
            },
            {
                "from": "Figma design team",
                "subject": "Updates to Project Mickey wireframes",
                "date": "Yesterday",
                "snippet": "We have updated the design tokens and added new layout grids for mobile responsive viewports."
            }
        ]
        
    try:
        # Connect to Gmail IMAP
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_address, app_password)
        mail.select("inbox")
        
        # Search for all emails in Inbox
        status, messages = mail.search(None, "ALL")
        if status != "OK":
            return [{"error": "Failed to search inbox messages."}]
            
        mail_ids = messages[0].split()
        latest_ids = mail_ids[-max_results:]
        
        results = []
        # Fetch newest first
        for mail_id in reversed(latest_ids):
            status, msg_data = mail.fetch(mail_id, "(RFC822)")
            if status != "OK":
                continue
                
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Decode Subject
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding or "utf-8", errors="replace")
                        
                    # Decode Sender
                    from_, encoding = decode_header(msg["From"])[0]
                    if isinstance(from_, bytes):
                        from_ = from_.decode(encoding or "utf-8", errors="replace")
                        
                    date_ = msg.get("Date", "")
                    
                    # Extract body snippet
                    snippet = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                payload = part.get_payload(decode=True)
                                if payload:
                                    snippet = payload.decode(errors="replace")[:120] + "..."
                                    break
                    else:
                        payload = msg.get_payload(decode=True)
                        if payload:
                            snippet = payload.decode(errors="replace")[:120] + "..."
                            
                    results.append({
                        "from": from_,
                        "subject": subject,
                        "date": date_,
                        "snippet": snippet
                    })
        mail.logout()
        return results
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Gmail IMAP connection failed: {error_msg}")
        if "Application-specific password required" in error_msg:
            return [{
                "error": "Google App Password Required",
                "snippet": "Gmail connection requires a 16-character Google App Password. Please visit Google Account Security Settings to generate one, and enter it in Mickey Settings."
            }]
        return [{"error": f"Failed to connect to Gmail: {error_msg}"}]
