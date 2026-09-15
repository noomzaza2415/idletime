# ใช้ alpine ให้ image เล็ก เหมาะกับ server ที่พื้นที่จำกัด
FROM node:22-alpine

# alpine ไม่มีฐานข้อมูล timezone มาให้ ต้องลงเองก่อน ไม่งั้น TZ=Asia/Bangkok จะไม่มีผล
# แล้วเวลาทั้งหมดจะเป็น UTC ซึ่งช้ากว่าไทย 7 ชั่วโมง ทำให้คำนวณกะและช่วงพักผิด
RUN apk add --no-cache tzdata
ENV TZ=Asia/Bangkok

WORKDIR /app

# ก๊อป manifest ก่อนแล้วค่อย install เพื่อให้ layer นี้ถูก cache ไว้
# แก้โค้ดแล้ว build ใหม่จะไม่ต้องโหลด dependency ซ้ำ
COPY package.json package-lock.json ./

# npm ci ยึดตาม package-lock.json เป๊ะ ได้ผลเหมือนกันทุกครั้งที่ build
RUN npm ci --omit=dev

COPY src ./src

# สร้างที่เก็บข้อมูลและโอนสิทธิ์ให้ผู้ใช้ node ก่อนสลับผู้ใช้
# ถ้าไม่ทำ ตอนรันจริงจะเขียนไฟล์ token ไม่ได้เพราะโฟลเดอร์เป็นของ root
RUN mkdir -p /app/data && chown -R node:node /app

# ที่เก็บ token ต้อง mount ออกมา ไม่งั้นข้อมูลหายเมื่อลบ container
VOLUME ["/app/data"]

ENV PORT=8090
EXPOSE 8090

# รันด้วยผู้ใช้ที่ไม่ใช่ root ลดความเสียหายถ้าบริการถูกเจาะ
USER node

# ตรวจสุขภาพเองในตัว docker จะได้รู้ว่า container ยังตอบสนองอยู่จริง ไม่ใช่แค่ยังไม่ตาย
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8090)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ค่าจาก .env ถูกส่งเข้ามาเป็น environment variable โดย compose อยู่แล้ว
# --env-file-if-exists ไว้เผื่อกรณีรันด้วย docker run ธรรมดาที่ mount .env เข้ามา
CMD ["node", "--env-file-if-exists=.env", "src/server.js"]
