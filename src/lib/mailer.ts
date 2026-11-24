// Email delivery is deferred. In development the OTP is printed to the console.
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  console.log(`[mailer] OTP for ${email}: ${code}`);
}
