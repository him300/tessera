import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="notfound wrap">
      {/* React 19 hoists this into <head>, so the 404 is not titled like the home page. */}
      <title>No tile for this day · Tessera</title>
      <div className="notfound__text">
        <h1 className="display">This day has no tile.</h1>
        <p className="lede">
          The page you asked for is not part of the record. Every day in the workbook has a row, and
          every row has a tile on the floor, but this address was never one of them.
        </p>
        <div style={{ display: 'flex', gap: '0.6em', flexWrap: 'wrap' }}>
          <Link className="btn" href="/">
            Back to the floor
          </Link>
          <Link className="btn btn--ghost" href="/ledger">
            Read the ledger
          </Link>
        </div>
      </div>
      <div className="hole" aria-hidden="true">
        {Array.from({ length: 35 }, (_, i) => (
          <i key={i} data-hole={i === 16 ? 'true' : undefined} />
        ))}
      </div>
    </div>
  );
}
