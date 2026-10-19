import './donation-button.css';

/** Decorative control: deliberately has no link, form submission or click handler. */
export function DonationButton() {
  return (
    <span className="donation-control">
      <button className="donation-button" type="button">
        <span className="donation-button__pulse" aria-hidden="true" />
        <span className="donation-button__label">捐款</span>
      </button>
    </span>
  );
}
