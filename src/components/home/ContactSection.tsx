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
          <div className="space-y-5 bg-white rounded-2xl p-6 shadow-sm">
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
                <a href="tel:0820752606" className="text-gray-600 text-sm hover:text-orange">082-075-2606</a>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="text-2xl">✉️</span>
              <div>
                <p className="font-bold text-navy mb-0.5">อีเมล</p>
                <a href="mailto:looktao.diceshop@gmail.com" className="text-gray-600 text-sm hover:text-orange">looktao.diceshop@gmail.com</a>
              </div>
            </div>

            {/* Social media */}
            <div>
              <p className="font-bold text-navy mb-3">ติดตามเรา</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://www.facebook.com/profile.php?id=61557368743890"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#1877F2] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </a>
                <a
                  href="https://www.instagram.com/looktaodiceshop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-gradient-to-br from-purple-500 via-pink-500 to-orange text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@looktao.diceshop?is_from_webapp=1&sender_device=pc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-black text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>
                  TikTok
                </a>
                <a
                  href="https://www.youtube.com/@diceshop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#FF0000] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                  YouTube
                </a>
                <a
                  href="www.youtube.com/@ร้านลูกเต๋าDiceshop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-[#00B900] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                >
                  💬 Line
                </a>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden h-64 md:h-auto shadow-md ring-1 ring-sand min-h-[300px]">
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
