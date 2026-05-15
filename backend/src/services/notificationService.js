// Stub. Wire up nodemailer / twilio with env vars in production.
export async function notifyExpiringSoon(member, daysLeft) {
  console.log(`[NOTIFY] ${member.memberId} (${member.email}) — plan expires in ${daysLeft} days`);
}
export async function notifyExpired(member) {
  console.log(`[NOTIFY] ${member.memberId} (${member.email}) — plan EXPIRED today`);
}
