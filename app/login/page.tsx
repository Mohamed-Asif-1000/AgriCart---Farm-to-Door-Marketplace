"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Eye,
  EyeOff,
  Leaf,
  ShieldCheck,
  Store,
  Truck,
  User,
} from "lucide-react";
import {
  fieldClass,
  FieldShell,
  FormBanner,
} from "../components/FormField";
import {
  DASHBOARD_BY_ROLE,
  accountId,
  findUser,
  readUsers,
  writeSession,
  writeUsers,
  type Role,
  type StoredUser,
} from "../lib/session";
import { ensureProfileFor, profileFor } from "../lib/store";

type Mode = "login" | "register";
type Field = "name" | "email" | "password" | "farmName" | "location";

type FormValues = Record<Field, string>;

// The old pattern was /^[^\s@]+\.[^\s@]+$/ - it contained no literal "@" at
// all. Both character classes explicitly exclude it and a dot was the only
// required separator, so it rejected every real address ("anitasharma@gmail.com")
// while happily accepting "foo.bar". The literal @ plus a TLD of at least two
// characters is what distinguishes an address from a typo. Deliberately no
// backtracking-heavy lookarounds: this only has to be correct, not exhaustive.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;

const ROLES: { value: Role; label: string; icon: typeof User }[] = [
  { value: "customer", label: "Customer", icon: User },
  { value: "farmer", label: "Farmer", icon: Store },
  { value: "delivery", label: "Delivery", icon: Truck },
  { value: "admin", label: "Admin", icon: ShieldCheck },
];

const STAGES = {
  login: {
    image: "/hero/hero-green-grain.jpg",
    alt: "Fresh green grain on a plant",
    eyebrow: "Welcome to Agricart",
    title: "Fresh from our fields to your table",
    copy: "Shop seasonal produce grown by verified local farmers, with same-day delivery across the valley.",
  },
  register: {
    image: "/hero/hero-vegetables.jpg",
    alt: "A spread of freshly harvested vegetables",
    eyebrow: "Join Agricart",
    title: "Grow, sell and deliver with us",
    copy: "Create one account to shop produce or list your harvest and reach thousands of local buyers.",
  },
} as const;

function validate(
  values: FormValues,
  mode: Mode,
  role: Role,
  emailTaken: boolean
): Record<Field, string | null> {
  const isRegister = mode === "register";
  // A farm name and a location are what an admin approves against, and they are
  // what the storefront prints under every listing, so they are asked for up front
  // rather than left blank for the farmer to discover on their own dashboard.
  const isFarmerRegister = isRegister && role === "farmer";

  return {
    name: isRegister
      ? values.name.trim().length >= 2
        ? null
        : "Please enter your full name."
      : null,
    email: !EMAIL_PATTERN.test(values.email.trim())
      ? "Enter a valid email address."
      : isRegister && emailTaken
        ? "An account already exists for this email and role."
        : null,
    password: isRegister
      ? values.password.length >= MIN_PASSWORD
        ? null
        : `Password must be at least ${MIN_PASSWORD} characters.`
      : values.password.length > 0
        ? null
        : "Please enter your password.",
    farmName: isFarmerRegister
      ? values.farmName.trim().length >= 2
        ? null
        : "Please enter your farm's name."
      : null,
    location: isFarmerRegister
      ? values.location.trim().length >= 2
        ? null
        : "Please enter the area you farm in."
      : null,
  };
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("customer");
  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    password: "",
    farmName: "",
    location: "",
  });
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    email: false,
    password: false,
    farmName: false,
    location: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const loginHeadingRef = useRef<HTMLHeadingElement>(null);
  const registerHeadingRef = useRef<HTMLHeadingElement>(null);
  const initialised = useRef(false);
  const mounted = useRef(false);

  const isRegister = mode === "register";

  // readUsers() touches localStorage, so it cannot run during render: the
  // server has no storage and the first client render would disagree with the
  // server HTML. The account list is refreshed whenever the fields that affect
  // it change, and the duplicate check is enforced again on submit.
  const [knownUsers, setKnownUsers] = useState<StoredUser[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setKnownUsers(readUsers());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const emailTaken =
    isRegister &&
    values.email.trim() !== "" &&
    knownUsers.some(
      (user) =>
        user.email.trim().toLowerCase() === values.email.trim().toLowerCase() &&
        user.role === role
    );

  const errors = validate(values, mode, role, emailTaken);

  useGSAP(
    () => {
      const login = loginRef.current;
      const register = registerRef.current;
      if (!login || !register) return;

      const firstRun = !initialised.current;
      initialised.current = true;

      if (firstRun || prefersReducedMotion()) {
        gsap.set(login, { x: 0 });
        gsap.set(register, { x: "100%" });
        return;
      }

      const incoming = mode === "login" ? login : register;
      const outgoing = mode === "login" ? register : login;

      gsap.to(incoming, { x: 0, duration: 0.55, ease: "power3.inOut" });
      gsap.to(outgoing, {
        x: mode === "login" ? "100%" : "-100%",
        duration: 0.55,
        ease: "power3.inOut",
      });
    },
    { dependencies: [mode], scope: stageRef }
  );

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const heading =
      mode === "login" ? loginHeadingRef.current : registerHeadingRef.current;
    heading?.focus();
  }, [mode]);

  function handleChange(field: Field) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setValues((prev) => ({ ...prev, [field]: next }));
      setFormError(null);
    };
  }

  function handleBlur(field: Field) {
    return () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    };
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setTouched({
      name: false,
      email: false,
      password: false,
      farmName: false,
      location: false,
    });
    setFormError(null);
    setNotice(null);
  }

  function goToDashboard(user: Pick<StoredUser, "name" | "email" | "role">) {
    // The session deliberately drops the password field.
    writeSession({ name: user.name, email: user.email, role: user.role });
    router.push(DASHBOARD_BY_ROLE[user.role]);
  }

  function handleLogin(event: FormEvent) {
    event.preventDefault();
    setTouched({
      name: false,
      email: true,
      password: true,
      farmName: false,
      location: false,
    });

    if (errors.email || errors.password) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }

    const match = findUser(values.email, role, values.password);

    if (!match) {
      setFormError(
        "We could not match those details. Check your password and role."
      );
      return;
    }

    // A profile must exist before the dashboard reads it, so a brand-new
    // account has a real record to save addresses and payment methods into
    // rather than falling back to a throwaway one that is discarded on save.
    ensureProfileFor(match.id, match.role);

    // Admin's suspend button is only meaningful if it actually stops the account
    // signing in. Pending is deliberately allowed through: that is a farmer
    // waiting to be approved, not a punished one, and they still need their
    // dashboard to see the listings awaiting review.
    const status = profileFor(match.id, match.role).accountStatus;
    if (status === "Suspended") {
      setFormError(
        "This account has been suspended. Please contact support to restore it."
      );
      return;
    }

    goToDashboard({ name: match.name, email: match.email, role: match.role });
  }

  function handleRegister(event: FormEvent) {
    event.preventDefault();
    setTouched({
      name: true,
      email: true,
      password: true,
      farmName: true,
      location: true,
    });

    if (errors.name || errors.email || errors.password || errors.farmName || errors.location) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }

    const email = values.email.trim().toLowerCase();
    const name = values.name.trim();
    const users = readUsers();

    if (
      users.some(
        (user) =>
          user.email.trim().toLowerCase() === email && user.role === role
      )
    ) {
      setFormError("An account already exists for this email and role.");
      return;
    }

    // id is derived from email + role rather than generated, so a product, an
    // order and a profile can all be attributed to this account without a lookup
    // table - and so an account created here and one created by admin are the
    // same account.
    const id = accountId(email, role);

    if (!writeUsers([...users, { id, name, email, password: values.password, role, createdAt: new Date().toISOString() }])) {
      setFormError("This browser refused to store the new account. Check that site data is allowed.");
      return;
    }

    // The farm details go in with the account rather than being collected later:
    // this is the profile the storefront prints on every listing and the one an
    // admin approves against, so leaving it empty would mean a new farmer's
    // produce shows up with no farm name until they noticed the sidebar.
    ensureProfileFor(
      id,
      role,
      role === "farmer"
        ? { farmName: values.farmName.trim(), location: values.location.trim() }
        : undefined
    );

    setValues({ name: "", email, password: "", farmName: "", location: "" });
    setTouched({
      name: false,
      email: false,
      password: false,
      farmName: false,
      location: false,
    });
    setFormError(null);
    setNotice(`Account created for ${name}. Please sign in to continue.`);
    setMode("login");
  }

  return (
    <main className="bg-emerald-50/40 px-4 py-8 sm:px-6 md:py-14">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 shadow-sm ring-1 ring-emerald-100">
            <Leaf size={14} />
            Agricart
          </span>
        </div>

        <div
          ref={stageRef}
          className="relative grid overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-emerald-900/5"
        >
          <section
            ref={loginRef}
            aria-hidden={mode !== "login"}
            inert={mode !== "login"}
            className="col-start-1 row-start-1 grid md:grid-cols-2"
          >
            <div className="relative hidden min-h-72 md:block">
              <Image
                src={STAGES.login.image}
                alt={STAGES.login.alt}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-900/45 to-emerald-800/25" />
              <div className="absolute inset-x-0 bottom-0 p-8 text-white">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-200">
                  {STAGES.login.eyebrow}
                </p>
                <h1 className="text-3xl font-black leading-tight">
                  {STAGES.login.title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-emerald-50/85">
                  {STAGES.login.copy}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-10">
              <h2
                ref={loginHeadingRef}
                tabIndex={-1}
                className="text-2xl font-black text-slate-900 outline-none"
              >
                Sign in
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Use your registered details to continue.
              </p>

              <div className="mt-5 rounded-2xl bg-emerald-900 px-3 py-2 md:hidden">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                  {STAGES.login.eyebrow}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {STAGES.login.title}
                </p>
              </div>

              <form className="mt-6 space-y-4" noValidate onSubmit={handleLogin}>
                <fieldset>
                  <legend className="mb-2 block text-sm font-semibold text-slate-700">
                    I am signing in as
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(({ value, label, icon: Icon }) => {
                      const active = role === value;
                      return (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                            active
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={value}
                            checked={active}
                            onChange={() => setRole(value)}
                            className="h-4 w-4 shrink-0 accent-emerald-600"
                          />
                          <Icon
                            size={16}
                            className={
                              active ? "text-emerald-600" : "text-slate-400"
                            }
                          />
                          <span className="text-sm font-semibold text-slate-800">
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {notice ? (
                  <FormBanner tone="success">{notice}</FormBanner>
                ) : null}
                {formError ? (
                  <FormBanner tone="error">{formError}</FormBanner>
                ) : null}

                <FieldShell
                  id="login-email"
                  label="Email address"
                  error={errors.email}
                  showError={touched.email}
                >
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={values.email}
                    onChange={handleChange("email")}
                    onBlur={handleBlur("email")}
                    aria-invalid={Boolean(touched.email && errors.email)}
                    aria-describedby={
                      touched.email && errors.email
                        ? "login-email-error"
                        : undefined
                    }
                    className={fieldClass(touched.email, errors.email)}
                  />
                </FieldShell>

                <FieldShell
                  id="login-password"
                  label="Password"
                  error={errors.password}
                  showError={touched.password}
                >
                  <div className="relative">
                    <input
                      id="login-password"
                      type={revealPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={values.password}
                      onChange={handleChange("password")}
                      onBlur={handleBlur("password")}
                      aria-invalid={Boolean(
                        touched.password && errors.password
                      )}
                      aria-describedby={
                        touched.password && errors.password
                          ? "login-password-error"
                          : undefined
                      }
                      className={`${fieldClass(
                        touched.password,
                        errors.password
                      )} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setRevealPassword((prev) => !prev)}
                      aria-label={
                        revealPassword ? "Hide password" : "Show password"
                      }
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-emerald-700"
                    >
                      {revealPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </FieldShell>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Sign in
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                New to Agricart?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-bold text-emerald-700 underline-offset-2 hover:underline"
                >
                  Create an account
                </button>
              </p>
            </div>
          </section>

          <section
            ref={registerRef}
            aria-hidden={mode !== "register"}
            inert={mode !== "register"}
            className="col-start-1 row-start-1 grid md:grid-cols-2"
            style={{ transform: "translateX(100%)" }}
          >
            <div className="relative hidden min-h-72 md:block">
              <Image
                src={STAGES.register.image}
                alt={STAGES.register.alt}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-900/45 to-emerald-800/25" />
              <div className="absolute inset-x-0 bottom-0 p-8 text-white">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-200">
                  {STAGES.register.eyebrow}
                </p>
                <h1 className="text-3xl font-black leading-tight">
                  {STAGES.register.title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-emerald-50/85">
                  {STAGES.register.copy}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-10">
              <h2
                ref={registerHeadingRef}
                tabIndex={-1}
                className="text-2xl font-black text-slate-900 outline-none"
              >
                Create account
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                It takes less than a minute to get started.
              </p>

              <div className="mt-5 rounded-2xl bg-emerald-900 px-3 py-2 md:hidden">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                  {STAGES.register.eyebrow}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {STAGES.register.title}
                </p>
              </div>

              <form className="mt-6 space-y-4" noValidate onSubmit={handleRegister}>
                <fieldset>
                  <legend className="mb-2 block text-sm font-semibold text-slate-700">
                    I want to join as
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(({ value, label, icon: Icon }) => {
                      const active = role === value;
                      return (
                        <label
                          key={value}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                            active
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="register-role"
                            value={value}
                            checked={active}
                            onChange={() => setRole(value)}
                            className="h-4 w-4 shrink-0 accent-emerald-600"
                          />
                          <Icon
                            size={16}
                            className={
                              active ? "text-emerald-600" : "text-slate-400"
                            }
                          />
                          <span className="text-sm font-semibold text-slate-800">
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {formError ? (
                  <FormBanner tone="error">{formError}</FormBanner>
                ) : null}

                <FieldShell
                  id="register-name"
                  label="Full name"
                  error={errors.name}
                  showError={touched.name}
                >
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    placeholder="e.g. Anita Sharma"
                    value={values.name}
                    onChange={handleChange("name")}
                    onBlur={handleBlur("name")}
                    aria-invalid={Boolean(touched.name && errors.name)}
                    aria-describedby={
                      touched.name && errors.name
                        ? "register-name-error"
                        : undefined
                    }
                    className={fieldClass(touched.name, errors.name)}
                  />
                </FieldShell>

                <FieldShell
                  id="register-email"
                  label="Email address"
                  error={errors.email}
                  showError={touched.email}
                >
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={values.email}
                    onChange={handleChange("email")}
                    onBlur={handleBlur("email")}
                    aria-invalid={Boolean(touched.email && errors.email)}
                    aria-describedby={
                      touched.email && errors.email
                        ? "register-email-error"
                        : undefined
                    }
                    className={fieldClass(touched.email, errors.email)}
                  />
                </FieldShell>

                <FieldShell
                  id="register-password"
                  label="Password"
                  error={errors.password}
                  showError={touched.password}
                >
                  <div className="relative">
                    <input
                      id="register-password"
                      type={revealPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSWORD} characters`}
                      value={values.password}
                      onChange={handleChange("password")}
                      onBlur={handleBlur("password")}
                      aria-invalid={Boolean(
                        touched.password && errors.password
                      )}
                      aria-describedby={
                        touched.password && errors.password
                          ? "register-password-error"
                          : undefined
                      }
                      className={`${fieldClass(
                        touched.password,
                        errors.password
                      )} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setRevealPassword((prev) => !prev)}
                      aria-label={
                        revealPassword ? "Hide password" : "Show password"
                      }
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-emerald-700"
                    >
                      {revealPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </FieldShell>

                {/* Farm fields appear only for a farmer. They are asked for at
                    registration because the farm name and area are printed under
                    every one of this account's listings and are what an admin
                    approves against. */}
                {role === "farmer" ? (
                  <>
                    <FieldShell
                      id="register-farmName"
                      label="Farm name"
                      error={errors.farmName}
                      showError={touched.farmName}
                    >
                      <input
                        id="register-farmName"
                        type="text"
                        placeholder="e.g. Green Valley Farm"
                        value={values.farmName}
                        onChange={handleChange("farmName")}
                        onBlur={handleBlur("farmName")}
                        aria-invalid={Boolean(touched.farmName && errors.farmName)}
                        aria-describedby={
                          touched.farmName && errors.farmName
                            ? "register-farmName-error"
                            : undefined
                        }
                        className={fieldClass(touched.farmName, errors.farmName)}
                      />
                    </FieldShell>

                    <FieldShell
                      id="register-location"
                      label="Location"
                      error={errors.location}
                      showError={touched.location}
                    >
                      <input
                        id="register-location"
                        type="text"
                        placeholder="e.g. Wayanad, Kerala"
                        value={values.location}
                        onChange={handleChange("location")}
                        onBlur={handleBlur("location")}
                        aria-invalid={Boolean(touched.location && errors.location)}
                        aria-describedby={
                          touched.location && errors.location
                            ? "register-location-error"
                            : undefined
                        }
                        className={fieldClass(touched.location, errors.location)}
                      />
                    </FieldShell>
                  </>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Create account
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-emerald-700 underline-offset-2 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Protected by Agricart. By continuing you agree to our{" "}
          <Link href="/" className="font-semibold text-emerald-700">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/" className="font-semibold text-emerald-700">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
