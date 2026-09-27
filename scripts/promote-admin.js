// Runs inside the auth pod (piped in by promote-admin.bat): sets one account's platform role.
const m = require('mongoose');
(async () => {
  await m.connect(process.env.MONGO_URI);
  const r = await m.connection.db
    .collection('users')
    .updateOne({ email: process.env.EMAIL }, { $set: { role: process.env.ROLE } });
  console.log(
    r.matchedCount
      ? `${process.env.EMAIL} is now ${process.env.ROLE} (log out and back in)`
      : `no user ${process.env.EMAIL}`
  );
  await m.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
