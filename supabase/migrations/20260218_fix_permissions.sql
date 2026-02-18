-- Enable SELECT for authenticated users on market_items
create policy "Enable read access for authenticated users"
on "public"."market_items"
as permissive
for select
to authenticated
using (true);

-- Enable SELECT for authenticated users on quizzes
create policy "Enable read access for authenticated users"
on "public"."quizzes"
as permissive
for select
to authenticated
using (true);

-- Enable SELECT for authenticated users on daily_quizzes
create policy "Enable read access for authenticated users"
on "public"."daily_quizzes"
as permissive
for select
to authenticated
using (true);

-- Ensure seats are visible (usually they are public, but just in case)
create policy "Enable read access for authenticated users"
on "public"."seats"
as permissive
for select
to authenticated
using (true);
