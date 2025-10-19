export default function DemoPage() {
  return (
    <div>
      <h1>Demo Page</h1>
    </div>
  )
}

export async function setup() {
  'use server'

  return {
    success: true,
    message: 'Setup completed',
  }
}