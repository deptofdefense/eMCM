function idForChain(chain) {
	var section = chain[chain.length - 1]
	if (section.type === 'part') {
		currentAnchorType = section.anchors
	}

	for (var i = 0, count = chain.length; i < count; i++) {
		if (chain[i].type !== 'chapter' && chain[i].type !== 'part') {
			var startIndex = i
			break
		}
	}

	var id
	if (currentAnchorType && typeof startIndex !== 'undefined') {
		id = currentAnchorType + '-' + chain.slice(startIndex).map(function(subsection) {return subsection.index}).join('-')
	} else {
		id = chain.map(function(section) {
			return section.type + '-' + (section.index || section._i)
		}).join('_')
	}

	return parameterize(id)
}

var ROMAN_TITLE_TYPES = {
	'part': ' - ',
	'chapter': '. '
}

function titleForSection(section) {
	var romanSeparator = ROMAN_TITLE_TYPES[section.type]
	if (romanSeparator && section.index) {
		return romanize(section.index) + romanSeparator + section.title
	}

	if (section.type === 'rule') {
		return section.index + '. ' + section.title
	} else if (section.type === 'article') {
		return section.index + '&ndash;' + section.title
	} else if (section.type === 'appendix') {
		return (section.index) + '. ' + section.title
	}

	return section.title
}

var currentAnchorType
function headerForSection(section) {
	var result
	var id = section.index
	if (section.type === 'part') {
		result = "<h1>"
		if (id) result += "PART " + romanize(id) + "<br>"
		result += section.title.toUpperCase()
		result += "</h1>"
	} else if (section.type === 'chapter') {
		result = "<h1>"
		result += "CHAPTER " + romanize(id) + ". " + section.title.toUpperCase()
		result += "</h1>"
	} else if (section.type === 'rule') {
		result = "<h3>Rule " + id + ". " + section.title + "</h3>"
		// if (currentAnchorType) result += "<a id=\"" + currentAnchorType + "-" + id + "\"></a>"
	} else if (section.type === 'article') {
		result = "<h3>Article " + id + "&mdash;" + section.title + "</h3>"
	} else if (section.type === 'appendix') {
		result = "<h1>APPENDIX " + id + "<br>"
		result += section.title.toUpperCase()
		result += "</h1>"
	} else {
		result = "<h3>" + section.title + "</h3>"
	}
	return result
}

function fetch(url, callback) {
	var request = new XMLHttpRequest()
	request.addEventListener('load', function() {callback(this.responseText)})
	request.open('GET', url)
	request.send()
}

function parameterize(string) {
	return string.trim().replace(/[\s|-]+/g, '-').split(/[^\w|-]/)[0].toLowerCase()
}

var REGEXP_TRANSFORMS = [
	[/<(\/?)b/gi, '<$1strong'],
	[/<(\/?)i/gi, '<$1em'],
	[/<(\/?)list/gi, '<$1ol'],
]

var URL_REGEXP = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm
var RCM_REGEXP = /R\.C\.M\.\s*(\d+)((\(\w+\))*)/ig
var MILREVID_REGEXP = /Mil\.R\.Evid\.\s*(\d+)((\(\w+\))*)/ig

function contentize(html) {
	REGEXP_TRANSFORMS.forEach(function(transform) {
		html = html.replace(transform[0], transform[1])
	})

	return html.
		replace(URL_REGEXP, '<a href="$&">$&</a>').
		replace(RCM_REGEXP, function(string, rule, sections) {
			sections = sections.replace(/\)\(/g, '-').replace(/\(|\)/g, '')
			var path = ['rcm', rule]
			if (sections) path.push(sections)
			return '<a href="#' + path.join('-') + '">' + string + '</a>'
		}).
		replace(MILREVID_REGEXP, function(string, rule, sections) {
			sections = sections.replace(/\)\(/g, '-').replace(/\(|\)/g, '')
			var path = ['milrevid', rule]
			if (sections) path.push(sections)
			return '<a href="#' + path.join('-') + '">' + string + '</a>'
		})
}

var LIST_TYPES = {
	'I': /I/,
	'i': /i/,
	'A': /[A-Z]/,
	'a': /[a-z]/,
	'1': /[0-9]/,
}

var ALPHABET = ['a', 'b', 'c', 'd', 'e',
				'f', 'g', 'h', 'i', 'j',
				'k', 'l', 'm', 'n', 'o',
				'p', 'q', 'r', 's', 't',
				'u', 'v', 'w', 'x', 'y',
				'z']

var HASH_PREFIX_REGEXP = /^((rcm|milrevid|art)-\d+)/

function fixListElements(el) {
	var lists = el.querySelectorAll('ol')
	forEach(lists, function(list) {
		forEach(list.children, function(li) {
			var index = li.getAttribute('index')
			li.removeAttribute('index')
			if (li.nodeName.toUpperCase() === 'LI' && index) {
				if (!list.type) {
					for (var listType in LIST_TYPES) {
						if (LIST_TYPES[listType].test(index)) {
							list.type = listType
							break
						}
					}
				}

				if (list.type === '1') {
					li.value = parseInt(index)
				} else if (listType === 'a' || listType === 'A') {
					li.value = ALPHABET.indexOf(index.toLowerCase()) + 1
				}

				var el = li
				while (el = el.parentNode) {
					if (el.id && el.id.match(HASH_PREFIX_REGEXP)) {
						li.id = el.id + '-' + li.getAttribute('index')
						break
					}
				}
			}
		})
	})
}

function fixDiscussionElements(el) {
	var els = el.querySelectorAll('discussion')
	forEach(els, function(disc) {
		var row = document.createElement('div')
		row.className = 'row'

		var referenceNode = disc.parentNode
		referenceNode.parentNode.insertBefore(row, referenceNode)

		var col = document.createElement('div')
		col.className = 'col-xs-12 col-sm-7'
		col.appendChild(referenceNode)
		row.appendChild(col)

		var newCol = document.createElement('div')
		newCol.className = 'col-xs-12 col-sm-5'
		newCol.appendChild(disc)
		row.appendChild(newCol)
	})
}

function fixTableElements(el) {
	var tables = el.querySelectorAll('table')
	forEach(tables, function(table) {
		table.className += "table table-bordered table-condensed"
	})
}

function romanizeTitle(title) {
	var comps = title.split(' - ')
	if (comps.length > 1) {
		var romanized = [romanize(comps[0])]
		if (!romanized[0]) romanized.pop()

		romanized.push(comps[1])
		return romanized.join(' - ')
	} else { return comps[0] }
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

function forEachRecursive(array, func, chain) {
	if (!chain) chain = []

	array.forEach(function(object, i) {
		object._i = i
		var newChain = chain.concat(object)
		func(object, newChain)
		if (object.children) {
			forEachRecursive(object.children, func, newChain)
		}
	})
}

function flattenArray(array, childrenKey, result) {
	if (!array) { return result }
	if (!result) { result = [] }

	forEach(array, function(object) {
		result.push(object)

		var children = childrenKey ? object[childrenKey] : object
		if (Array.isArray(children)) {
			flattenArray(children, childrenKey, result)
		}
	})

	return result
}

function arrayToHash(array, childrenKey, result, chain) {
	if (!array) { return result }
	if (!result) { result = {} }
	if (!chain) { chain = [] }

	forEach(array, function(object, i) {
		var newChain = chain.concat(object)
		if (!object._i) { object._i = i }
		if (!object.id) { object.id = idForChain(newChain) }
		result[object.id] = object

		var children = childrenKey ? object[childrenKey] : object
		if (Array.isArray(children)) {
			arrayToHash(children, childrenKey, result, newChain)
		}
	})

	return result
}

function forEach(array, func) {
	if (!array) { return }
	Array.prototype.forEach.call(array, func)
}

function debounce(func, delay) {
	var timeout
	return function() {
		if (timeout) {
			clearTimeout(timeout)
		}

		timeout = setTimeout(func, delay)
	}
}

Object.forEach = function(object, func) {
	for (var key in object) {
		if (object.hasOwnProperty(key)) {
			func(key, object[key])
		}
	}
}
