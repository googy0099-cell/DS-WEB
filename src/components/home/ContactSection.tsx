export default function ContactSection() {
  return (
    <section id="contact" className="py-16 px-4 bg-cream">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-2">ติดต่อเรา</p>
          <h2 className="text-2xl md:text-3xl font-bold text-navy">มาเจอกัน</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact info */}
          <div className="space-y-5">
            <div className="flex gap-4 items-start">
              <span className="text-2xl">📍</span>
              <div>
                <p className="font-bold text-navy mb-0.5">ที่อยู่</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  ร้านลูกเต๋า (Dice Shop)<br />
                  10/30-31 ถนนเจริญประดิษฐ์ ตำบลสะบารัง<br />
                  อำเภอเมือง จังหวัดปัตตานี 94000
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="text-2xl">🕐</span>
              <div>
                <p className="font-bold text-navy mb-0.5">เวลาเปิดทำการ</p>
                <p className="text-gray-600 text-sm">15:00 – 23:00 น. ทุกวัน</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="text-2xl">📞</span>
              <div>
                <p className="font-bold text-navy mb-0.5">โทรศัพท์</p>
                <p className="text-gray-600 text-sm">082-075-2606</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="text-2xl">✉️</span>
              <div>
                <p className="font-bold text-navy mb-0.5">อีเมล</p>
                <p className="text-gray-600 text-sm">looktao.diceshop@gmail.com</p>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <a
                href="#"
                className="flex items-center gap-2 bg-navy text-cream text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-navy/90 transition-colors"
              >
                <span>💬</span> Line
              </a>
              <a
                href="#"
                className="flex items-center gap-2 bg-orange text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-orange/90 transition-colors"
              >
                <span>📘</span> <a href="https://www.facebook.com/diceshop" target="_blank" rel="noopener noreferrer">Facebook</a>
              </a>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden h-64 md:h-auto shadow-sm min-h-[300px]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1980.6027884525588!2d101.2404283519481!3d6.8659510916585855!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31b305fc5204d243%3A0x25dbaf97e1f4784!2z4Lij4LmJ4Liy4LiZ4Lil4Li54LiB4LmA4LiV4LmL4LiyIChEaWNlU2hvcCk!5e0!3m2!1sen!2sth!4v1779327034066!5m2!1sen!2sth"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "300px" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
