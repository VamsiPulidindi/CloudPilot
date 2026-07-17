import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, User } from "@/lib/db";

export async function GET() {
  const db = readDb();
  const currentUser = db.users.find(u => u.id === db.currentSessionUserId);
  if (currentUser) {
    return NextResponse.json({ 
      success: true, 
      user: { id: currentUser.id, username: currentUser.username, email: currentUser.email } 
    });
  }
  return NextResponse.json({ success: false, user: null });
}

export async function POST(req: NextRequest) {
  try {
    const { action, email, username, password } = await req.json();
    const db = readDb();

    if (action === "register") {
      if (!email || !username || !password) {
        return NextResponse.json({ success: false, message: "All fields are required." }, { status: 400 });
      }

      const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        return NextResponse.json({ success: false, message: "User already exists with this email." }, { status: 400 });
      }

      const newUser: User = {
        id: `usr-${Date.now()}`,
        email: email.toLowerCase(),
        username,
        passwordHash: `pbkdf2_sha256$${password}`, // Simple hashing for representation
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      db.currentSessionUserId = newUser.id;
      writeDb(db);

      return NextResponse.json({ 
        success: true, 
        user: { id: newUser.id, username: newUser.username, email: newUser.email } 
      });
    }

    if (action === "login") {
      if (!email || !password) {
        return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });
      }

      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user || user.passwordHash !== `pbkdf2_sha256$${password}`) {
        return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
      }

      db.currentSessionUserId = user.id;
      writeDb(db);

      return NextResponse.json({ 
        success: true, 
        user: { id: user.id, username: user.username, email: user.email } 
      });
    }

    if (action === "logout") {
      db.currentSessionUserId = null;
      writeDb(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
