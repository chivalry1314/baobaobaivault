package main

import (
	"fmt"
	"os"

	"github.com/baobaobai/baobaobaivault/internal/webpush"
)

func main() {
	publicKey, privateKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to generate VAPID keys: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("VAPID_PUBLIC_KEY=" + publicKey)
	fmt.Println("VAPID_PRIVATE_KEY=" + privateKey)
	fmt.Println()
	fmt.Println("# config.yaml snippet:")
	fmt.Println("webpush:")
	fmt.Println("  enabled: true")
	fmt.Println("  public_api_enabled: true")
	fmt.Println("  vapid_subject: \"mailto:push-admin@example.com\"")
	fmt.Println("  vapid_public_key: \"" + publicKey + "\"")
	fmt.Println("  vapid_private_key: \"" + privateKey + "\"")
}

