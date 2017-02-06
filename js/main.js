$(function() {
	var navSelector = "#toc"
	var $nav = $(navSelector)

	$('body').scrollspy({
		target: navSelector
	})

	var navItem = document.querySelector('[data-navitem-proto]')
	var contentItem = document.querySelector('[data-content-proto]')

	var container = navItem.parentNode
	container.removeChild(navItem)
	container.removeChild(contentItem)

	// fetch('/toc.json', function(json) {
	// 	var toc = JSON.parse(json)
	// 	for (var key in toc) {
	// 		var item = navItem.cloneNode(true)
	// 		var comps = key.split(' - ')
	// 		if (comps.length > 1) {
	// 			var romanized = [romanize(comps[0])]
	// 			if (!romanized[0]) romanized.pop()
	// 			romanized.push(comps[1])
	// 			romanized = romanized.join(' - ')
	// 		} else { romanized = comps[0] }
	// 		item.querySelector('h2').innerHTML = romanized
	// 		container.appendChild(item)
	// 	}
	// })

	var REPLACEMENTS = {
		header: 'h1',
		list: 'ol'
	}

	fetch('/mcm.html', function(html) {
		console.log('loaded')
		for (var key in REPLACEMENTS) {
			html = html.replace(new RegExp("<(/?)" + key, 'g'), "<$1" + REPLACEMENTS[key])
		}

console.log('replaced')
		document.getElementById('content').innerHTML = html
		console.log('rendered')

		Toc.init($nav)
	})

	function fetch(url, callback) {
		var request = new XMLHttpRequest()
		request.addEventListener('load', function() {callback(this.responseText)})
		request.open('GET', url)
		request.send()
	}

	function romanize(num) {
		var lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}, roman = '', i
		for (i in lookup) {
			while (num >= lookup[i]) {
				roman += i
				num -= lookup[i]
			}
		}
		
		return roman
	}

	function pushPage(path) {

	}

})