import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

export async function generatePromptPayQR(amountTHB: number): Promise<string> {
  const promptPayId = process.env.PROMPTPAY_ID ?? "";
  const payload = generatePayload(promptPayId, { amount: amountTHB });
  const dataUrl = await QRCode.toDataURL(payload, {
    width: 300,
    margin: 2,
    color: { dark: "#182a47", light: "#ffffff" },
  });
  return dataUrl;
}
