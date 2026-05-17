import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Mom's Kitchen <onboarding@resend.dev>";

const getResend = () => {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

async function sendEmail({ to, subject, html }) {
  const resend = getResend();
  if (!resend) {
    console.warn("[NOTIFY] RESEND_API_KEY not found. Skipping email sending.");
    return;
  }

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  console.log(`[NOTIFY] Email sent to ${to} (id: ${data?.id})`);
  return data;
}

export async function notifyExpiringSoon(member, daysLeft) {
  console.log(`[NOTIFY] Preparing to email ${member.memberId} (${member.email}) - expires in ${daysLeft} days`);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #6366f1;">Action Required: Subscription Expiring</h2>
      <p>Hello <strong>${member.name}</strong>,</p>
      <p>This is a friendly reminder that your meal plan subscription at Mom's Kitchen is expiring in <strong>${daysLeft} days</strong>.</p>
      <p>To avoid any interruption to your daily meals, please visit the mess office to renew your subscription.</p>
      <br />
      <p>Thank you,</p>
      <p><strong>Mom's Kitchen Administration</strong></p>
    </div>
  `;

  try {
    await sendEmail({
      to: member.email,
      subject: `Your meal plan expires in ${daysLeft} days!`,
      html,
    });
    console.log(`[NOTIFY] Email sent to ${member.email}`);
  } catch (err) {
    console.error(`[NOTIFY-ERROR] Failed to send email to ${member.email}:`, err.message);
  }
}

export async function notifyExpired(member) {
  console.log(`[NOTIFY] Preparing to email ${member.memberId} (${member.email}) - plan EXPIRED`);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px; background-color: #fffafb;">
      <h2 style="color: #ef4444;">Subscription Expired</h2>
      <p>Hello <strong>${member.name}</strong>,</p>
      <p>Your meal plan subscription at Mom's Kitchen has officially <strong>expired</strong>.</p>
      <p>Your dynamic QR code is now inactive and you will not be able to scan for meals.</p>
      <p>Please visit the mess office at your earliest convenience to renew your plan.</p>
      <br />
      <p>Thank you,</p>
      <p><strong>Mom's Kitchen Administration</strong></p>
    </div>
  `;

  try {
    await sendEmail({
      to: member.email,
      subject: `Action Required: Your meal plan has expired`,
      html,
    });
    console.log(`[NOTIFY] Expiration email sent to ${member.email}`);
  } catch (err) {
    console.error(`[NOTIFY-ERROR] Failed to send email to ${member.email}:`, err.message);
  }
}

export async function sendPasswordResetEmail(member, resetLink) {
  console.log(`[NOTIFY] Preparing password reset email for ${member.memberId} (${member.email})`);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e7ff; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">Reset Your Password</h2>
        <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Mom's Kitchen Central Portal</p>
      </div>
      <p>Hello <strong>${member.name}</strong>,</p>
      <p>We received a request to reset your password for your Mom's Kitchen account (ID: <strong>${member.memberId}</strong>).</p>
      <p>Click the button below to choose a new password. This link is valid for <strong>15 minutes</strong> and can only be used once.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      
      <p style="font-size: 12px; color: #9ca3af;">If the button doesn't work, you can copy and paste the following link directly into your browser:</p>
      <p style="font-size: 12px; color: #4f46e5; word-break: break-all;">${resetLink}</p>
      
      <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 25px 0;" />
      <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: member.email,
      subject: "Reset your Mom's Kitchen password",
      html,
    });
    console.log(`[NOTIFY] Password reset email sent to ${member.email}`);
  } catch (err) {
    console.error(`[NOTIFY-ERROR] Failed to send password reset email to ${member.email}:`, err.message);
    throw err;
  }
}

export async function sendRegistrationReceivedEmail(member) {
  console.log(`[NOTIFY] Preparing registration received email for ${member.memberId} (${member.email})`);

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e7ff; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px;">
        <h2 style="color: #6366f1; margin: 0; font-size: 24px;">Registration Received! 🥣</h2>
        <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Mom's Kitchen Campus Meal Portal</p>
      </div>
      
      <p>Hello <strong>${member.name}</strong>,</p>
      <p>Thank you for registering at Mom's Kitchen! We are excited to serve you fresh, quality meals.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;"><strong>Your Account Credentials:</strong></p>
        <p style="margin: 0 0 5px 0; font-size: 14px;">Member ID: <strong style="color: #6366f1; font-size: 16px;">${member.memberId}</strong></p>
        <p style="margin: 0; font-size: 12px; color: #64748b;">(Use this Member ID along with your chosen password to log into your dashboard)</p>
      </div>

      <div style="border-left: 4px solid #f59e0b; background-color: #fffbeb; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #b45309; font-weight: bold;">⚠️ Subscription Pending Activation</p>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #d97706; line-height: 1.4;">
          Your account is currently inactive. Please visit the mess office to verify your identity, make your plan payment, and activate your daily QR code.
        </p>
      </div>

      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Once activated, you can log in to access your secure, dynamic QR code to scan for your registered meals.
      </p>
      
      <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 25px 0;" />
      <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
        Need help? Contact the hostel kitchen office or reply directly to this email.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: member.email,
      subject: "Welcome to Mom's Kitchen - Registration Pending Activation",
      html,
    });
    console.log(`[NOTIFY] Registration email sent to ${member.email}`);
  } catch (err) {
    console.error(`[NOTIFY-ERROR] Failed to send registration email to ${member.email}:`, err.message);
  }
}

export async function sendPlanActivatedEmail(member, planDetails) {
  console.log(`[NOTIFY] Preparing plan activation email for ${member.memberId} (${member.email})`);

  const mealChips = (planDetails.meals || [])
    .map(m => `<span style="background-color: #e0e7ff; color: #4338ca; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-right: 5px; display: inline-block;">${m}</span>`)
    .join("");

  const dueMessage = planDetails.dueAmount > 0 
    ? `<p style="margin: 0; font-size: 13px; color: #ef4444; font-weight: bold;">Pending Balance Due: ₹${planDetails.dueAmount}</p>` 
    : `<p style="margin: 0; font-size: 13px; color: #10b981; font-weight: bold;">Plan fully paid! No dues remaining.</p>`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #d1fae5; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ecfdf5; padding-bottom: 15px;">
        <h2 style="color: #10b981; margin: 0; font-size: 24px;">Your Plan is Active! 🎉</h2>
        <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Mom's Kitchen Campus Meal Portal</p>
      </div>
      
      <p>Hello <strong>${member.name}</strong>,</p>
      <p>We are pleased to inform you that your hostel meal plan subscription has been <strong>approved and activated</strong>!</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; color: #166534; font-size: 16px; border-bottom: 1px solid #dcfce7; padding-bottom: 5px;">Plan Details:</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #475569; width: 35%;"><strong>Selected Plan:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${planDetails.label || "Custom Plan"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569;"><strong>Meals Included:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${mealChips || "None"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569;"><strong>Valid From:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${planDetails.startDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569;"><strong>Valid Until:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${planDetails.endDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569;"><strong>Total Price:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">₹${planDetails.price}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569;"><strong>Amount Paid:</strong></td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: bold; color: #10b981;">₹${planDetails.amountPaid}</td>
          </tr>
        </table>
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed #bbf7d0;">
          ${dueMessage}
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/login" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Access Member Portal</a>
      </div>

      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        You can now log in using your Member ID (<strong>${member.memberId}</strong>) to view your <strong>dynamic, rotating QR code</strong>. Show this QR code to the scanner at the kitchen during your registered meal hours to get served!
      </p>
      
      <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 25px 0;" />
      <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
        Enjoy your meals! If you have any questions, feel free to visit the mess office.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: member.email,
      subject: "Subscription Activated! Welcome to Mom's Kitchen 🎉",
      html,
    });
    console.log(`[NOTIFY] Plan activation email sent to ${member.email}`);
  } catch (err) {
    console.error(`[NOTIFY-ERROR] Failed to send plan activation email to ${member.email}:`, err.message);
  }
}
