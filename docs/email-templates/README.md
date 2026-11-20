# Email templates (EmailJS)

Debrief sends two emails, both from the api through the EmailJS REST API, and both **only to the
person themselves** (never a copy to us):

| File                  | When                                               | Variables                                              |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `password-reset.html` | Someone uses "Forgot password?"                    | `to_name`, `to_email`, `reset_link`, `expires_minutes` |
| `welcome.html`        | A new account is created (email sign-up or Google) | `to_name`, `to_email`                                  |

Open either file in a browser to preview it (the `{{...}}` parts are filled in by EmailJS).

## Setting up each template in EmailJS

1. **Email Templates → Create New Template**. Pick **Password Reset** for the reset email and
   **Welcome** for the welcome email (only to start from: the content is replaced in step 2).
2. **Content** tab → **Edit Content** → switch to the **code editor** (`<>`), delete everything
   and paste the whole HTML file.
3. Settings on the right:
   - **Subject:** `Reset your Debrief password` / `Welcome to Debrief, {{to_name}}`
   - **To Email:** `{{to_email}}` ← important: the default is _your own_ address, which would
     send every email to you instead of the user.
   - **From Name:** `Debrief`
   - **Reply To:** leave empty (or a support address), and leave **Bcc** empty.
4. Don't turn on the template's **Auto-Reply** tab: that's for contact forms. The welcome email is
   a normal template the api sends straight to the new user.
5. Save, and copy the template ID into `.env`:
   - password reset → `EMAILJS_TEMPLATE_ID`
   - welcome → `EMAILJS_WELCOME_TEMPLATE_ID`

Also needed in `.env`: `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, and in
EmailJS **Account → Security**, turn on **"Allow EmailJS API for non-browser applications"**.

## Why the HTML looks old-fashioned

Email clients (Outlook especially) ignore most modern CSS. So the templates use tables for
layout, inline styles, system fonts and no images (the logo is drawn with coloured blocks):
plain, but it renders the same everywhere, including on phones.
