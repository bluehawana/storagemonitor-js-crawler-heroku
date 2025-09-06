# Security Guidelines

## 🛡️ Credential Management

**IMPORTANT:** This project has been flagged for credential exposure. Follow these guidelines:

### 1. Environment Variables
- **NEVER** commit real credentials to git
- Use placeholder values in `.env` files
- Real credentials should only exist in your local `.env` file
- Use different passwords for production vs development

### 2. Git History Cleanup
If you've already committed sensitive data:

```bash
# Remove the file from git tracking (but keep local copy)
git rm --cached .env

# Create a commit removing it
git commit -m "Remove sensitive credentials from tracking"

# Force push to overwrite history (be careful!)
git push --force-with-lease origin main
```

### 3. Secure Credential Storage
```bash
# Copy template and fill with real values
cp .env.example .env.local

# Use secure passwords
# For Gmail SMTP, use App Passwords, not your main password
```

### 4. GitGuardian Alert Response
When GitGuardian detects secrets:
1. ✅ Rotate/change exposed credentials immediately
2. ✅ Remove from git history 
3. ✅ Update security practices
4. ✅ Review access logs for unauthorized usage

### 5. Best Practices
- Use environment-specific config files
- Implement secret rotation policies
- Monitor for unauthorized access
- Use secure credential storage services
- Regular security audits

## 📧 SMTP Security
- Use Gmail App Passwords (not main password)
- Enable 2FA on email accounts
- Limit SMTP access to specific IPs when possible
- Monitor email sending logs

## 🔒 Database Security
- Use connection strings without embedded passwords
- Implement database user restrictions
- Regular backup encryption
- Connection pooling limits

## 🚨 Incident Response
If credentials are compromised:
1. Immediately change all affected passwords
2. Review access logs
3. Check for unauthorized usage
4. Update all systems using those credentials
5. Document the incident

---
**Remember:** Security is everyone's responsibility. When in doubt, ask!