package cert

import (
	"errors"
	"fmt"
	"net"
	"regexp"
	"sort"
	"strings"
)

func NamesFromConfigVar(configVariable string) ([]string, error) {
	if len(configVariable) == 0 {
		return nil, errors.New("no certificate names specified")
	}

	parts := strings.Split(configVariable, ";")
	names := make([]string, 0, len(parts))

	for _, part := range parts {
		name := strings.TrimSpace(part)
		if !isDNSName(name) {
			return nil, fmt.Errorf("%q is not a valid DNS name", name)
		}
		names = append(names, name)
	}

	sort.Strings(names)

	return names, nil
}

func isDNSName(str string) bool {
	if str == "" || len(strings.Replace(str, ".", "", -1)) > 255 {
		// constraints already violated
		return false
	}
	return !isIP(str) && rxDNSName.MatchString(str)
}

func isIP(str string) bool {
	return net.ParseIP(str) != nil
}

var rxDNSName = regexp.MustCompile(
	`^([a-zA-Z0-9_*][a-zA-Z0-9_-]{0,62}){1}(\.[a-zA-Z0-9_]{1}[a-zA-Z0-9_-]{0,62})*[._]?$`)

