# Manual Setup Guide for Oriola Website

Since the website appears to be behind a VPN or internal network, you'll need to manually identify the CSS selectors. Here's how:

## Step 1: Access the Website

1. **Open your browser** and go to the login page
2. **Make sure you can access**: `https://oriola-kd.com/login` (or whatever the correct URL is)
3. **Note the correct URL** if it's different

## Step 2: Find CSS Selectors

### Finding Username Field Selector:
1. **Right-click** on the email/username input field
2. **Select "Inspect Element"**
3. **Look for the `<input>` tag** in the HTML
4. **Note the attributes**:
   - `id="..."` → Use `#the-id`
   - `name="..."` → Use `input[name="the-name"]`
   - `class="..."` → Use `.the-class`

**Common patterns:**
```html
<!-- If you see this HTML -->
<input id="email" type="email" name="user_email">
<!-- Use this selector -->
#email

<!-- Or if you see -->
<input name="username" type="text" class="form-control">
<!-- Use this selector -->
input[name="username"]
```

### Finding Password Field Selector:
1. **Right-click** on the password input field
2. **Inspect the element**
3. **Look for** `type="password"`
4. **Use the same logic** as username field

**Common patterns:**
```html
<input id="password" type="password" name="user_password">
<!-- Use: #password -->

<input name="password" type="password" class="pass-input">
<!-- Use: input[name="password"] -->
```

### Finding Login Button Selector:
1. **Right-click** on the "Login" or "Submit" button
2. **Inspect the element**
3. **Look for** `<button>` or `<input type="submit">`

**Common patterns:**
```html
<button type="submit" id="login-btn">Login</button>
<!-- Use: #login-btn -->

<button type="submit" class="btn-primary">Sign In</button>
<!-- Use: button[type="submit"] -->

<input type="submit" value="Login">
<!-- Use: input[type="submit"] -->
```

### Finding Success Indicator:
**After you log in successfully**, look for elements that only appear when logged in:
- Navigation menus
- Dashboard content
- User profile areas
- "Logout" buttons

```html
<!-- Look for elements like these after login -->
<div class="user-dashboard">...</div>
<!-- Use: .user-dashboard -->

<nav id="main-nav">...</nav>
<!-- Use: #main-nav -->

<a href="/logout">Logout</a>
<!-- Use: a[href*="logout"] -->
```

## Step 3: Test Selectors

**Open browser console** (F12 → Console tab) and test:
```javascript
// Test if selector finds the element
document.querySelector('#email')          // Should highlight email field
document.querySelector('#password')       // Should highlight password field
document.querySelector('button[type="submit"]') // Should highlight login button
```

## Step 4: Update .env File

Once you find the selectors, update your `.env` file:

```env
# Replace with your actual selectors
USERNAME_SELECTOR=#email
PASSWORD_SELECTOR=#password
LOGIN_BUTTON_SELECTOR=button[type="submit"]
LOGIN_SUCCESS_SELECTOR=.user-dashboard
```

## Common Selector Examples

### Username Field:
- `#email`
- `#username`
- `input[name="email"]`
- `input[name="username"]`
- `input[type="email"]`
- `.email-input`

### Password Field:
- `#password`
- `input[name="password"]`
- `input[type="password"]`
- `.password-input`

### Submit Button:
- `button[type="submit"]`
- `input[type="submit"]`
- `#login-button`
- `.login-btn`
- `.btn-submit`

### Success Indicators:
- `.dashboard`
- `.main-content`
- `.user-nav`
- `#main-dashboard`
- `.profile-menu`
- `a[href*="logout"]`

## Step 5: Test Login

After updating the `.env` file, run:
```bash
node test-login.js
```

## Troubleshooting

### If login fails:
1. **Double-check selectors** - the most common issue
2. **Check for CAPTCHA** - some sites require human verification
3. **Look for additional fields** - some sites have extra security fields
4. **Check form submission** - some sites use AJAX instead of form submit

### Common Issues:
- **Wrong selectors**: Element not found errors
- **Dynamic content**: Selectors work but elements load later
- **CSRF tokens**: Hidden security fields required
- **JavaScript validation**: Client-side validation preventing submission

Let me know the selectors you find and we can test the login!